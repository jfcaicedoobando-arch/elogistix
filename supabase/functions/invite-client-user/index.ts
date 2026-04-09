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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
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
      // Use inviteUserByEmail — this creates the user AND sends the invite email
      const redirectTo = `${req.headers.get("origin") || "https://elogistix.lovable.app"}/portal/login`;
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { role: "cliente" },
      });

      if (inviteError || !inviteData.user) {
        console.error("Error inviting user:", inviteError);
        return new Response(
          JSON.stringify({ error: `Error al invitar usuario: ${inviteError?.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      userId = inviteData.user.id;
    }

    // Ensure user has 'cliente' role
    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("id, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingRole) {
      await supabaseAdmin.from("user_roles").insert({
        user_id: userId,
        role: "cliente",
      });
    } else if (existingRole.role !== "cliente") {
      await supabaseAdmin
        .from("user_roles")
        .update({ role: "cliente" })
        .eq("id", existingRole.id);
    }

    // Create client_users link
    const { error: linkError } = await supabaseAdmin.from("client_users").upsert(
      { user_id: userId, cliente_id, organization_id },
      { onConflict: "user_id,cliente_id" }
    );

    if (linkError) {
      console.error("Error linking user:", linkError);
      return new Response(
        JSON.stringify({ error: `Error al vincular usuario: ${linkError.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
    console.error("Internal error:", err);
    return new Response(
      JSON.stringify({ error: "Error interno del servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
