/**
 * Guardas de `parse-invoice-pdf` (R2 seguridad · P1 — drenaje de cuota IA).
 *
 * Antes la función sólo validaba el JWT: cualquier sesión (incluidos portal
 * cliente, agente de carga y la cuenta demo pública) podía subir PDFs de 10 MB
 * en bucle contra Gemini con la llave del servidor.
 *
 * Reglas: membresía de organización + rol con permiso de captura CxP y rate
 * limit persistente por usuario y por org (fail-CLOSED, patrón R4EF-03).
 */
import { errorResponse, jsonResponse } from "../_shared/response.ts";
import { authorizeOrgRole, ROLES_CAPTURA_CXP, type AuthContext } from "../_shared/auth.ts";
import type { createLogger } from "../_shared/logger.ts";
import { captureEdgeException } from "../_shared/sentry.ts";

type Log = ReturnType<typeof createLogger>;
type Cors = Record<string, string>;

export const RL_USUARIO = { windowSeconds: 3600, max: 20 } as const;
export const RL_ORG = { windowSeconds: 3600, max: 100 } as const;

/** Rate limit fail-CLOSED vía RPC `check_ratelimit`. */
async function checkRateLimitIa(
  auth: AuthContext,
  cors: Cors,
  log: Log,
  llave: string,
  tope: { windowSeconds: number; max: number },
): Promise<Response | null> {
  const { data: rl, error: rlErr } = await auth.adminClient.rpc("check_ratelimit", {
    p_key: llave,
    p_window_seconds: tope.windowSeconds,
    p_max: tope.max,
  });
  if (rlErr) {
    await captureEdgeException(new Error(`check_ratelimit failed: ${rlErr.message}`), {
      fn: "parse-invoice-pdf",
      status_code: 503,
      extra: { llave },
    });
    log.finish(503, "rate_limit_unavailable", { user_id: auth.userId });
    return errorResponse("rate_limit_unavailable", 503, cors);
  }
  const rlResult = rl as { ok?: boolean; retry_after?: number } | null;
  if (rlResult?.ok === false) {
    log.finish(429, "rate_limited", { user_id: auth.userId, payload: { llave } });
    return jsonResponse(
      { error: "Demasiadas solicitudes de parseo con IA. Intenta más tarde." },
      429,
      { ...cors, "Retry-After": String(rlResult.retry_after ?? tope.windowSeconds) },
    );
  }
  return null;
}

/**
 * Exige membresía de org + rol de captura CxP y aplica los topes de uso.
 * Devuelve `null` si puede continuar, o la Response de rechazo (403/429/503).
 */
export async function autorizarYLimitar(
  auth: AuthContext,
  cors: Cors,
  log: Log,
): Promise<Response | null> {
  const { data: membership } = await auth.adminClient
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", auth.userId)
    .limit(1)
    .maybeSingle();
  const orgId = (membership as { organization_id?: string } | null)?.organization_id;
  if (!orgId) {
    log.finish(403, "no_membership", { user_id: auth.userId });
    return errorResponse("Tu usuario no pertenece a ninguna organización", 403, cors);
  }
  const okRol = await authorizeOrgRole(auth.adminClient, auth.userId, orgId, ROLES_CAPTURA_CXP);
  if (!okRol) {
    log.finish(403, "forbidden_role", { user_id: auth.userId, organization_id: orgId });
    return errorResponse("Requiere un rol con permiso de captura CxP", 403, cors);
  }
  const rlUser = await checkRateLimitIa(
    auth, cors, log, `parse-invoice-pdf:user:${auth.userId}`, RL_USUARIO,
  );
  if (rlUser) return rlUser;
  return await checkRateLimitIa(auth, cors, log, `parse-invoice-pdf:org:${orgId}`, RL_ORG);
}
