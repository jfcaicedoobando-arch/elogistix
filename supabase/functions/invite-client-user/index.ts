import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { handlePreflight } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return errorResponse("No autorizado", 401);
    }

    const { email, cliente_id, organization_id } = await req.json();
    if (!email || !cliente_id || !organization_id) {
      return errorResponse("Faltan campos requeridos: email, cliente_id, organization_id", 400);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u) => u.email?.toLowerCase() === email.toLowerCase(),
    );

    const redirectTo = `${req.headers.get("origin") || "https://elogistix.lovable.app"}/portal/login`;
    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo },
      });
      const supabaseAnon = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
      );
      await supabaseAnon.auth.resetPasswordForEmail(email, { redirectTo });
    } else {
      const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
        redirectTo,
        data: { role: "cliente" },
      });
      if (inviteError || !inviteData.user) {
        console.error("Error inviting user:", inviteError);
        return errorResponse(`Error al invitar usuario: ${inviteError?.message}`, 500);
      }
      userId = inviteData.user.id;
    }

    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("id, role")
      .eq("user_id", userId)
      .maybeSingle();

    if (!existingRole) {
      await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "cliente" });
    } else if (existingRole.role !== "cliente") {
      await supabaseAdmin.from("user_roles").update({ role: "cliente" }).eq("id", existingRole.id);
    }

    const { error: linkError } = await supabaseAdmin.from("client_users").upsert(
      { user_id: userId, cliente_id, organization_id },
      { onConflict: "user_id,cliente_id" },
    );
    if (linkError) {
      console.error("Error linking user:", linkError);
      return errorResponse(`Error al vincular usuario: ${linkError.message}`, 500);
    }

    return jsonResponse({ success: true, user_id: userId, is_new: !existingUser });
  } catch (err) {
    console.error("Internal error:", err);
    return errorResponse("Error interno del servidor", 500);
  }
});
