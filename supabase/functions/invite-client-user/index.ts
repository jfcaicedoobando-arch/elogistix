// @ts-expect-error Deno remote import
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";
import { handlePreflightStrict, buildCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { authenticate, checkAdminAccess } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const cors = buildCors(req);

  try {
    // Validate JWT and admin access
    const { userId, adminClient } = await authenticate(req);
    const { isGlobalAdmin, orgId: callerOrgId } = await checkAdminAccess(
      adminClient,
      userId,
    );
    if (!isGlobalAdmin && !callerOrgId) {
      return errorResponse("Solo administradores", 403, cors);
    }

    const { email, cliente_id, organization_id } = await req.json();
    if (!email || !cliente_id || !organization_id) {
      return errorResponse(
        "Faltan campos requeridos: email, cliente_id, organization_id",
        400,
        cors,
      );
    }

    // Org admins can only invite for their own org
    if (!isGlobalAdmin && callerOrgId !== organization_id) {
      return errorResponse(
        "No autorizado para invitar usuarios a esa organización",
        403,
        cors,
      );
    }

    // Verify cliente_id belongs to the target organization
    const { data: cliente, error: clienteErr } = await adminClient
      .from("clientes")
      .select("id, organization_id")
      .eq("id", cliente_id)
      .maybeSingle();
    if (clienteErr || !cliente || cliente.organization_id !== organization_id) {
      return errorResponse("Cliente inválido para esa organización", 400, cors);
    }

    const supabaseAdmin = adminClient;

    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find(
      (u: { email?: string | null }) =>
        u.email?.toLowerCase() === email.toLowerCase(),
    );

    const redirectTo = `${
      req.headers.get("origin") || "https://elogistix.lovable.app"
    }/portal/login`;
    let userIdToLink: string;

    if (existingUser) {
      userIdToLink = existingUser.id;
      await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email,
        options: { redirectTo },
      });
      const supabaseAnon = createClient(
        // @ts-expect-error Deno global
        Deno.env.get("SUPABASE_URL")!,
        // @ts-expect-error Deno global
        Deno.env.get("SUPABASE_ANON_KEY")!,
      );
      await supabaseAnon.auth.resetPasswordForEmail(email, { redirectTo });
    } else {
      const { data: inviteData, error: inviteError } = await supabaseAdmin
        .auth.admin.inviteUserByEmail(email, {
          redirectTo,
          data: { role: "cliente" },
        });
      if (inviteError || !inviteData.user) {
        console.error("Error inviting user:", inviteError);
        return errorResponse(
          `Error al invitar usuario: ${inviteError?.message}`,
          500,
          cors,
        );
      }
      userIdToLink = inviteData.user.id;
    }

    // Only assign 'cliente' role if the user has NO role yet — never downgrade
    // an existing privileged user (admin/super_admin/operador) to cliente.
    const { data: existingRole } = await supabaseAdmin
      .from("user_roles")
      .select("id, role")
      .eq("user_id", userIdToLink)
      .maybeSingle();

    if (!existingRole) {
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: userIdToLink, role: "cliente" });
    }

    const { error: linkError } = await supabaseAdmin
      .from("client_users")
      .upsert(
        { user_id: userIdToLink, cliente_id, organization_id },
        { onConflict: "user_id,cliente_id" },
      );
    if (linkError) {
      console.error("Error linking user:", linkError);
      return errorResponse(
        `Error al vincular usuario: ${linkError.message}`,
        500,
        cors,
      );
    }

    return jsonResponse(
      { success: true, user_id: userIdToLink, is_new: !existingUser },
      200,
      cors,
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error interno";
    const [code, ...rest] = msg.split(":");
    const status = /^\d+$/.test(code) ? parseInt(code) : 500;
    console.error("invite-client-user error:", msg);
    return errorResponse(rest.join(":") || msg, status, cors);
  }
});
