/**
 * user-management — Edge function consolidada para CRUD de usuarios.
 *
 * Reemplaza las funciones: create-user, delete-user, list-users,
 * invite-client-user, list-client-users.
 *
 * Contrato: POST con body `{ action: string, ...payload }`. CORS estricto
 * (whitelist) y autenticación JWT compartida; cada acción aplica sus propias
 * validaciones de autorización (no se relajan respecto a las funciones
 * originales).
 *
 * Acciones soportadas:
 *  - "list"          → lista usuarios de la organización del caller
 *  - "create"        → crea un usuario y lo añade a la organización
 *  - "delete"        → elimina un usuario (bloquea self-delete y privesc)
 *  - "invite-client" → invita/vincula un usuario al portal de un cliente
 *  - "list-clients"  → lista los usuarios portal de un cliente
 *
 * v12.76.9: acepta `admin_org` como administrador de organización (era sólo `admin`).
 */
import { handlePreflightStrict, buildCors } from "../_shared/cors.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import { authenticate, checkAdminAccess } from "../_shared/auth.ts";
import { createLogger } from "../_shared/logger.ts";
import { initSentryEdge, captureEdgeException, debeReportarStatus } from "../_shared/sentry.ts";
import {
  handleCreate,
  handleDelete,
  handleList,
  handleListNombres,
  handleInviteClient,
  handleListClients,
} from "./handlers.ts";
import { handleInviteAgente, handleListAgentes } from "./agenteHandlers.ts";
import { handleInvite, handleResetPassword } from "./inviteHandler.ts";
import { handleListPortalEmails } from "./portalEmailsHandler.ts";

initSentryEdge("user-management");

export type Action =
  | "list"
  | "list-nombres"
  | "create"
  | "invite"
  | "reset-password"
  | "delete"
  | "invite-client"
  | "list-clients"
  | "invite-agente"
  | "list-agentes"
  | "list-portal-emails";

const ACTIONS = new Set<Action>([
  "list",
  "list-nombres",
  "create",
  "invite",
  "reset-password",
  "delete",
  "invite-client",
  "list-clients",
  "invite-agente",
  "list-agentes",
  "list-portal-emails",
]);

export function parseAction(raw: unknown): Action | null {
  if (!raw || typeof raw !== "object") return null;
  const a = (raw as { action?: unknown }).action;
  return typeof a === "string" && ACTIONS.has(a as Action) ? (a as Action) : null;
}

type Ctx = Parameters<typeof handleList>[0];
type AdminArg = Parameters<typeof handleList>[1];

/** Acciones que requieren resolver el nivel de administrador del caller. */
const ACCIONES_ADMIN = new Set<Action>([
  "list",
  "list-nombres",
  "create",
  "invite",
  "reset-password",
  "delete",
  "invite-client",
  "invite-agente",
  "list-portal-emails",
]);

const HANDLERS: Record<Action, (ctx: Ctx, admin: AdminArg) => Promise<Response>> = {
  list: handleList,
  "list-nombres": handleListNombres,
  create: handleCreate,
  invite: handleInvite,
  "reset-password": handleResetPassword,
  delete: handleDelete,
  "invite-client": handleInviteClient,
  "list-clients": (ctx) => handleListClients(ctx),
  "invite-agente": handleInviteAgente,
  "list-agentes": (ctx) => handleListAgentes(ctx),
  "list-portal-emails": handleListPortalEmails,
};

Deno.serve(async (req) => {
  const preflight = handlePreflightStrict(req);
  if (preflight) return preflight;
  const cors = buildCors(req);
  const log = createLogger(req, "user-management");

  try {
    const { userId: callerId, adminClient } = await authenticate(req);
    const body = await req.json().catch(() => null);
    const action = parseAction(body);
    if (!action) {
      log.finish(400, "invalid_action", { user_id: callerId });
      return errorResponse(
        "action inválida. Use: list | list-nombres | create | invite | reset-password | delete | invite-client | list-clients | invite-agente | list-agentes | list-portal-emails",
        400,
        cors,
      );
    }

    const ctx = { req, cors, log, callerId, adminClient, body: body as Record<string, unknown> };

    const admin = ACCIONES_ADMIN.has(action)
      ? await checkAdminAccess(adminClient, callerId)
      : null;
    const handler = HANDLERS[action];
    return await handler(ctx, admin!);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Error desconocido";
    const [code, ...rest] = msg.split(":");
    const status = /^\d+$/.test(code) ? parseInt(code) : 500;
    log.finish(status, "unhandled_error", { payload: { error: msg } });
    // 13.114.19: capturar también 4xx inesperados (antes sólo >=500). Esto
    // expone bugs de validación/permisos en `handlers` que se enmascaraban.
    if (debeReportarStatus(status)) await captureEdgeException(err, { fn: "user-management", status_code: status });
    return errorResponse(rest.join(":") || msg, status, cors);
  }
});
