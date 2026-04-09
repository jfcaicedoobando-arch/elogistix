import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Validate auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: "No autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { email, cliente_id, organization_id } = body;

    if (!email || !cliente_id || !organization_id) {
      return new Response(
        JSON.stringify({ error: "Faltan campos requeridos: email, cliente_id, organization_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check if user already exists
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase()
    );

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Create new user with a random password (they'll reset it)
      const tempPassword = crypto.randomUUID() + "Aa1!";
      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      });
      if (createError || !newUser.user) {
        return new Response(
          JSON.stringify({ error: `Error al crear usuario: ${createError?.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = newUser.user.id;
    }

    // Check if already has 'cliente' role
    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", userId)
      .eq("role", "cliente")
      .maybeSingle();

    if (!existingRole) {
      // Remove any existing roles first (a client shouldn't have admin/operador roles)
      // Only add if no existing role
      const { data: anyRole } = await supabaseAdmin
        .from("user_roles")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!anyRole) {
        await supabaseAdmin.from("user_roles").insert({
          user_id: userId,
          role: "cliente",
        });
      }
    }

    // Create client_users link (upsert to avoid duplicates)
    const { error: linkError } = await supabaseAdmin.from("client_users").upsert(
      { user_id: userId, cliente_id, organization_id },
      { onConflict: "user_id,cliente_id" }
    );

    if (linkError) {
      return new Response(
        JSON.stringify({ error: `Error al vincular usuario: ${linkError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send password reset email so user can set their password
    if (!existingUser) {
      await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
        options: {
          redirectTo: `${req.headers.get("origin") || Deno.env.get("SUPABASE_URL")}/portal/login`,
        },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        user_id: userId,
        is_new: !existingUser,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
