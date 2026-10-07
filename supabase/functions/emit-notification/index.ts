import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const {
      event_key,
      category = "project",
      type = "project",
      title,
      description = null,
      target_role = "admin",
      target_email = null,
      project_id = null,
      metadata = {},
      send_push = true,
    } = body;

    if (!title) {
      return new Response(
        JSON.stringify({ error: "title is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Call the emit_notification RPC function (handles dedup + insert)
    const { data: notifId, error: rpcError } = await supabase.rpc("emit_notification", {
      p_event_key: event_key,
      p_category: category,
      p_type: type,
      p_title: title,
      p_description: description,
      p_target_role: target_role,
      p_target_email: target_email,
      p_project_id: project_id,
      p_metadata: metadata,
      p_send_push: send_push,
    });

    if (rpcError) {
      return new Response(
        JSON.stringify({ error: rpcError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // If deduplicated (returned existing id), skip push
    if (!notifId) {
      return new Response(
        JSON.stringify({ id: null, deduplicated: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Send push notification if requested
    let pushResult = { sent: 0, failed: 0 };
    if (send_push) {
      const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
      if (vapidPrivateKey) {
        try {
          // Find device tokens for the target
          let tokenQuery = supabase
            .from("device_tokens")
            .select("endpoint, p256dh_key, auth_key, platform")
            .eq("active", true);

          // Try to match by user email or role
          if (target_email) {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id")
              .eq("email", target_email);
            if (profiles && profiles.length > 0) {
              tokenQuery = tokenQuery.in("user_id", profiles.map((p: { id: string }) => p.id));
            } else {
              // No profile found, no push
              return new Response(
                JSON.stringify({ id: notifId, deduplicated: false, push: pushResult }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } },
              );
            }
          } else {
            const { data: profiles } = await supabase
              .from("profiles")
              .select("id")
              .eq("role", target_role);
            if (!profiles || profiles.length === 0) {
              return new Response(
                JSON.stringify({ id: notifId, deduplicated: false, push: pushResult }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } },
              );
            }
            tokenQuery = tokenQuery.in("user_id", profiles.map((p: { id: string }) => p.id));
          }

          const { data: tokens } = await tokenQuery;
          if (tokens && tokens.length > 0) {
            const webPush = await import("npm:web-push@3.6.7");
            webPush.setVapidDetails(
              "mailto:notifications@editok.com",
              Deno.env.get("VAPID_PUBLIC_KEY") || "",
              vapidPrivateKey,
            );

            const payload = JSON.stringify({
              title,
              body: description || "You have a new notification",
              data: { notification_id: notifId, project_id, category, type, ...metadata },
            });

            for (const token of tokens) {
              const subscription = {
                endpoint: token.endpoint,
                keys: {
                  p256dh: token.p256dh_key || "",
                  auth: token.auth_key || "",
                },
              };
              try {
                await webPush.sendNotification(subscription, payload);
                pushResult.sent++;
              } catch {
                pushResult.failed++;
                await supabase
                  .from("device_tokens")
                  .update({ active: false })
                  .eq("endpoint", token.endpoint);
              }
            }
          }
        } catch {
          // Push failure shouldn't fail the notification creation
        }
      }
    }

    return new Response(
      JSON.stringify({ id: notifId, deduplicated: false, push: pushResult }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
