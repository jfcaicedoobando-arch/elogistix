import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "No autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Token inválido" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callerId = claimsData.claims.sub;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Check admin role: global OR organizational
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .in("role", ["admin", "super_admin"])
      .maybeSingle();

    let callerOrgId: string | null = null;

    if (!roleData) {
      // Check organizational role
      const { data: orgData } = await adminClient
        .from("organization_members")
        .select("role, organization_id")
        .eq("user_id", callerId)
        .eq("role", "admin")
        .maybeSingle();

      if (!orgData) {
        return new Response(JSON.stringify({ error: "Solo administradores pueden crear usuarios" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callerOrgId = orgData.organization_id;
    } else {
      // Global admin — get their org
      const { data: orgMember } = await adminClient
        .from("organization_members")
        .select("organization_id")
        .eq("user_id", callerId)
        .limit(1)
        .maybeSingle();
      callerOrgId = orgMember?.organization_id ?? null;
    }

    // Parse body
    const { email, password, role } = await req.json();

    if (!email || !password) {
      return new Response(JSON.stringify({ error: "Email y contraseña son requeridos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (password.length < 6) {
      return new Response(JSON.stringify({ error: "La contraseña debe tener al menos 6 caracteres" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validRoles = ["admin", "operador", "viewer"];
    const selectedRole = validRoles.includes(role) ? role : "viewer";

    // Create user with admin API
    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (createError) {
      return new Response(JSON.stringify({ error: createError.message }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The trigger handle_first_user_role inserts 'viewer' by default.
    // If the selected role is different, update it.
    if (selectedRole !== "viewer") {
      await adminClient
        .from("user_roles")
        .update({ role: selectedRole })
        .eq("user_id", newUser.user.id);
    }

    // Add to the caller's organization
    if (callerOrgId) {
      await adminClient
        .from("organization_members")
        .insert({
          user_id: newUser.user.id,
          organization_id: callerOrgId,
          role: selectedRole,
        });
    }

    return new Response(
      JSON.stringify({ user: { id: newUser.user.id, email: newUser.user.email } }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
