/**
 * Handler `list-nombres`: catálogo mínimo `{ id, full_name }` para roles
 * operativos que sólo necesitan resolver nombres (comisiones, auditoría),
 * sin exponer email ni señales de sesión (defecto 10).
 */
import type { HandlerCtx, AdminAccess } from "./types.ts";
import { jsonResponse, errorResponse } from "../_shared/response.ts";
import {
  resolveOrgScope,
  listarTodosLosUsuarios,
  filtrarPorOrganizacion,
  tieneAlgunRol,
} from "./listHandler.ts";

const ALLOWED_ROLES = new Set([
  "admin",
  "admin_org",
  "super_admin",
  "gerente_operaciones",
  "coordinador_logistico",
  "ejecutivo_pricing",
  "contador",
  "tesorero",
  "gerente_comercial",
  "gerente_visor",
  "viewer",
  "customer_service",
  "operador",
]);

export interface NombreUsuarioRow {
  id: string;
  full_name: string | null;
}

export async function handleListNombres(ctx: HandlerCtx, admin: AdminAccess): Promise<Response> {
  const { cors, log, callerId, adminClient } = ctx;

  const allowed = await tieneAlgunRol(adminClient, callerId, ALLOWED_ROLES);
  if (!allowed) {
    log.finish(403, "role_not_allowed", { user_id: callerId });
    return errorResponse("No autorizado para listar nombres de usuarios", 403, cors);
  }

  let orgId: string | null;
  try {
    orgId = await resolveOrgScope(adminClient, callerId, admin.isGlobalAdmin, admin.orgId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "403:Sin organización";
    log.finish(403, "no_org_membership", { user_id: callerId });
    return errorResponse(msg.replace(/^403:/, ""), 403, cors);
  }

  const baseRows = await listarTodosLosUsuarios(adminClient);
  const scoped = !admin.isGlobalAdmin && orgId
    ? await filtrarPorOrganizacion(adminClient, orgId, baseRows)
    : baseRows;

  const result: NombreUsuarioRow[] = scoped.map((u) => ({ id: u.id, full_name: u.full_name }));

  log.finish(200, "nombres_listed", {
    user_id: callerId,
    organization_id: orgId ?? null,
    payload: { count: result.length, scope: admin.isGlobalAdmin ? "global" : "org" },
  });
  return jsonResponse(result, 200, cors);
}
