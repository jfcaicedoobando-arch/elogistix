import { handlePreflightStrict, buildCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { authenticate, checkAdminAccess } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const cors = buildCors(req);

  try {
    const { userId: callerId, adminClient } = await authenticate(req);
    const { isGlobalAdmin, orgId: callerOrgId } = await checkAdminAccess(adminClient, callerId);

    if (!isGlobalAdmin && !callerOrgId) {
      return errorResponse("Solo administradores pueden crear usuarios", 403, cors);
    }

    const { email, password, role } = await req.json();
    if (!email || !password) return errorResponse("Email y contraseña son requeridos", 400, cors);
    if (password.length < 6) return errorResponse("La contraseña debe tener al menos 6 caracteres", 400, cors);

    const validRoles = ["admin", "operador", "viewer"];
    const selectedRole = validRoles.includes(role) ? role : "viewer";

    const { data: newUser, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createError) return errorResponse(createError.message, 400, cors);

    if (selectedRole !== "viewer") {
      await adminClient.from("user_roles").update({ role: selectedRole }).eq("user_id", newUser.user.id);
    }

    if (callerOrgId) {
      await adminClient.from("organization_members").insert({
        user_id: newUser.user.id,
        organization_id: callerOrgId,
        role: selectedRole,
      });
    }

    return jsonResponse({ user: { id: newUser.user.id, email: newUser.user.email } }, 200, cors);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    const [code, ...rest] = msg.split(":");
    const status = /^\d+$/.test(code) ? parseInt(code) : 500;
    return errorResponse(rest.join(":") || msg, status, cors);
  }
});
