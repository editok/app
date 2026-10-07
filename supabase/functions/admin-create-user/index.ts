import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface CreateRequestBody {
  email: string;
  password: string;
  fullName: string;
  role: "customer" | "editor" | "admin";
  adminRole?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { email, password, fullName, role, adminRole } = (await req.json()) as CreateRequestBody;

    if (!email || !password || !fullName || !role) {
      return new Response(JSON.stringify({ error: "email, password, fullName, and role are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (role !== "customer" && role !== "editor" && role !== "admin") {
      return new Response(JSON.stringify({ error: "role must be 'customer', 'editor', or 'admin'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Enforce caller permission: only Main Admins can create admin users
    if (role === "admin") {
      const authHeader = req.headers.get("Authorization") || "";
      const token = authHeader.replace("Bearer ", "").trim();
      const supabaseCaller = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
      );
      const { data: callerUser, error: callerError } = await supabaseCaller.auth.getUser();
      if (callerError || !callerUser.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: callerProfile } = await supabaseAdmin
        .from("profiles")
        .select("role, admin_role")
        .eq("id", callerUser.user.id)
        .maybeSingle();
      if (!callerProfile || callerProfile.role !== "admin" || (callerProfile.admin_role !== "main" && callerProfile.admin_role != null)) {
        return new Response(JSON.stringify({ error: "Only Main Admins can create admin users" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Check if a user with this email already exists
    const normalizedEmail = email.toLowerCase().trim();

    // Check profiles table first (avoids the unsupported getUserByEmail API)
    const { data: existingProfile } = await supabaseAdmin
      .from("profiles")
      .select("id, email, role")
      .ilike("email", normalizedEmail)
      .maybeSingle();
    if (existingProfile) {
      return new Response(JSON.stringify({ error: "A profile with this email already exists. Use a different email or let them sign in with Google." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Also check auth.users via listUsers as a fallback
    const { data: usersList } = await supabaseAdmin.auth.admin.listUsers();
    const existingAuthUser = (usersList?.users || []).find(
      (u) => (u.email || "").toLowerCase() === normalizedEmail,
    );
    if (existingAuthUser) {
      return new Response(JSON.stringify({ error: "A user with this email already exists. Use a different email or let them sign in with Google." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role, admin_role: role === "admin" ? (adminRole || "main") : undefined },
    });

    if (authError) {
      return new Response(JSON.stringify({ error: authError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = authData.user.id;

    const { error: profileError } = await supabaseAdmin.from("profiles").upsert({
      id: userId,
      email,
      full_name: fullName,
      role,
      admin_role: role === "admin" ? (adminRole || "main") : null,
      provider: "email",
      updated_at: new Date().toISOString(),
    });

    if (profileError) {
      console.error("Failed to upsert profile:", profileError.message);
    }

    return new Response(JSON.stringify({ id: userId, email, fullName, role, adminRole: role === "admin" ? (adminRole || "main") : undefined }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
