import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DeviceToken {
  endpoint: string;
  p256dh_key: string | null;
  auth_key: string | null;
  platform: string;
  fcm_token: string | null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
    // Firebase service account JSON for FCM HTTP v1
    const firebaseProjectId = Deno.env.get("FIREBASE_PROJECT_ID") || "";
    const firebaseClientEmail = Deno.env.get("FIREBASE_CLIENT_EMAIL") || "";
    const firebasePrivateKey = (Deno.env.get("FIREBASE_PRIVATE_KEY") || "").replace(/\\n/g, "\n");

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { user_id, title, body, data, target_role } = await req.json();

    if (!user_id && !target_role) {
      return new Response(
        JSON.stringify({ error: "Either user_id or target_role is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    let query = supabase
      .from("device_tokens")
      .select("endpoint, p256dh_key, auth_key, platform, fcm_token")
      .eq("active", true);

    if (user_id) {
      query = query.eq("user_id", user_id);
    } else if (target_role) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id")
        .eq("role", target_role);
      if (!profiles || profiles.length === 0) {
        return new Response(
          JSON.stringify({ sent: 0, message: "No users found for role" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const userIds = profiles.map((p: { id: string }) => p.id);
      query = query.in("user_id", userIds);
    }

    const { data: tokens, error } = await query;

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ sent: 0, message: "No active device tokens found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Partition tokens: FCM (native Android) vs web-push (VAPID)
    const fcmTokens: DeviceToken[] = (tokens as DeviceToken[]).filter((t) => !!t.fcm_token);
    const webTokens: DeviceToken[] = (tokens as DeviceToken[]).filter((t) => !t.fcm_token);

    let sent = 0;
    let failed = 0;

    // ---- FCM (Android native) ----
    if (fcmTokens.length > 0 && firebaseProjectId && firebaseClientEmail && firebasePrivateKey) {
      // Mint a Firebase OAuth2 access token using JWT (RS256)
      const accessToken = await getFcmAccessToken(firebaseClientEmail, firebasePrivateKey, firebaseProjectId);
      if (accessToken) {
        const fcmUrl = `https://fcm.googleapis.com/v1/projects/${firebaseProjectId}/messages:send`;
        for (const token of fcmTokens) {
          const message = {
            message: {
              token: token.fcm_token!,
              notification: {
                title: title || "EDITOK",
                body: body || "You have a new notification",
              },
              data: stringifyDataValues(data || {}),
              android: {
                priority: "high" as const,
                notification: {
                  icon: "ic_notification",
                  color: "#3b82f6",
                  sound: "default",
                },
              },
            },
          };
          try {
            const resp = await fetch(fcmUrl, {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(message),
            });
            if (resp.ok) {
              sent++;
            } else {
              failed++;
              const respText = await resp.text();
              // 404/UNREGISTERED → deactivate stale token
              if (resp.status === 404 || resp.status === 400) {
                await supabase.from("device_tokens").update({ active: false }).eq("endpoint", token.endpoint);
              }
              console.error("FCM send failed:", resp.status, respText);
            }
          } catch {
            failed++;
          }
        }
      } else {
        console.error("Failed to mint FCM access token — skipping FCM sends");
        failed += fcmTokens.length;
      }
    } else if (fcmTokens.length > 0) {
      // FCM tokens present but Firebase not configured
      console.error("FCM tokens present but FIREBASE_PROJECT_ID/EMAIL/KEY not configured");
      failed += fcmTokens.length;
    }

    // ---- Web Push (VAPID) ----
    if (webTokens.length > 0) {
      if (!vapidPrivateKey) {
        console.error("Web-push tokens present but VAPID_PRIVATE_KEY not configured");
        failed += webTokens.length;
      } else {
        const webPush = await import("npm:web-push@3.6.7");
        webPush.setVapidDetails("mailto:notifications@editok.com", vapidPublicKey, vapidPrivateKey);

        for (const token of webTokens) {
          const subscription = {
            endpoint: token.endpoint,
            keys: {
              p256dh: token.p256dh_key || "",
              auth: token.auth_key || "",
            },
          };
          const payload = JSON.stringify({
            title: title || "EDITOK",
            body: body || "You have a new notification",
            data: data || {},
          });
          try {
            await webPush.sendNotification(subscription, payload);
            sent++;
          } catch {
            failed++;
            await supabase.from("device_tokens").update({ active: false }).eq("endpoint", token.endpoint);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ sent, failed, total: tokens.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

/** FCM data payload values must be strings. */
function stringifyDataValues(data: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    out[key] = typeof value === "string" ? value : JSON.stringify(value);
  }
  return out;
}

/**
 * Mint a Google OAuth2 access token for the FCM scope using a JWT signed
 * with the Firebase service account private key. Uses the RS256 JWT format
 * and the Google token endpoint (no external deps).
 */
async function getFcmAccessToken(clientEmail: string, privateKey: string, projectId: string): Promise<string | null> {
  const now = Math.floor(Date.now() / 1000);
  const claim = {
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  };

  const jwt = await signRs256(claim, privateKey);
  if (!jwt) return null;

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!tokenResp.ok) {
    console.error("Google token exchange failed:", tokenResp.status, await tokenResp.text());
    return null;
  }
  const tokenJson = await tokenResp.json();
  return tokenJson.access_token || null;
}

/** Sign a JWT with RS256 using Web Crypto. Returns null on failure. */
async function signRs256(payload: Record<string, unknown>, pemKey: string): Promise<string | null> {
  try {
    const headerB64 = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
    const payloadB64 = base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${headerB64}.${payloadB64}`;

    const key = await importPemPrivateKey(pemKey);
    if (!key) return null;

    const signature = await crypto.subtle.sign(
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      key,
      new TextEncoder().encode(signingInput),
    );
    const signatureB64 = base64UrlEncodeBytes(new Uint8Array(signature));
    return `${signingInput}.${signatureB64}`;
  } catch (err) {
    console.error("JWT signing failed:", err);
    return null;
  }
}

/** Import a PEM-format RSA private key into a Web Crypto CryptoKey. */
async function importPemPrivateKey(pem: string): Promise<CryptoKey | null> {
  try {
    const pemContents = pem
      .replace(/-----BEGIN PRIVATE KEY-----/g, "")
      .replace(/-----END PRIVATE KEY-----/g, "")
      .replace(/\s/g, "");
    const binaryDer = base64ToUint8Array(pemContents);
    return await crypto.subtle.importKey(
      "pkcs8",
      binaryDer.buffer,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["sign"],
    );
  } catch (err) {
    console.error("PEM import failed:", err);
    return null;
  }
}

function base64UrlEncode(str: string): string {
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlEncodeBytes(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}
