/**
 * Handler `list-portal-emails`: resuelve emails de usuarios de portales
 * (cliente / agente) a partir de un array de user_ids.
 *
 * Necesario porque la acción `list` sólo retorna miembros de
 * `organization_members`, y los usuarios del portal viven en
 * `client_users` / `agente_users`. Sin esto, en `/usuarios` los emails de
 * portales aparecen como UNRESOLVED_EMAIL.
 *
 * Seguridad: sólo retorna emails de user_ids que estén vinculados a
 * client_users / agente_users de la organización del caller (o cualquier org
 * si es admin global). Evita fuga de emails cross-org.
 */
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import type { HandlerCtx, AdminAccess } from "./handlers.ts";

export async function handleListPortalEmails(
  ctx: HandlerCtx,
  admin: AdminAccess,
): Promise<Response> {
  const { cors, log, callerId, adminClient, body } = ctx;
  if (!admin.isGlobalAdmin && !admin.orgId) {
    log.finish(403, "not_admin", { user_id: callerId });
    return errorResponse("Solo administradores", 403, cors);
  }

  const rawIds = Array.isArray(body.user_ids) ? body.user_ids : [];
  const userIds = Array.from(
    new Set(rawIds.filter((v): v is string => typeof v === "string" && v.length > 0)),
  );
  if (userIds.length === 0) {
    return jsonResponse([], 200, cors);
  }

  // Filtra a sólo los user_ids autorizados según vínculos en la org del caller.
  const allowed = new Set<string>();

  const clientQuery = adminClient
    .from("client_users")
    .select("user_id, organization_id")
    .in("user_id", userIds);
  const agenteQuery = adminClient
    .from("agente_users")
    .select("user_id, organization_id")
    .in("user_id", userIds);

  const [clientRes, agenteRes] = await Promise.all([clientQuery, agenteQuery]);

  type Link = { user_id: string; organization_id: string };
  const collect = (rows: Link[] | null | undefined) => {
    (rows ?? []).forEach((r) => {
      if (admin.isGlobalAdmin || r.organization_id === admin.orgId) {
        allowed.add(r.user_id);
      }
    });
  };
  collect(clientRes.data as Link[] | null);
  collect(agenteRes.data as Link[] | null);

  const out: { id: string; email: string }[] = [];
  await Promise.all(
    Array.from(allowed).map(async (uid) => {
      const { data } = await adminClient.auth.admin.getUserById(uid);
      if (data?.user?.email) {
        out.push({ id: uid, email: data.user.email });
      }
    }),
  );

  log.finish(200, "portal_emails_listed", {
    user_id: callerId,
    organization_id: admin.orgId,
    payload: { requested: userIds.length, returned: out.length },
  });
  return jsonResponse(out, 200, cors);
}
