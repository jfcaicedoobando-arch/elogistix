/**
 * Ola P2 seguridad — Guarda compartida de Compras/CxP para edge functions que
 * consumen recursos caros (IA, Storage con service_role) en nombre del usuario.
 *
 * Extraída de `parse-invoice-pdf/guardas.ts` (R2 · P1) porque ahora la usan
 * también `parse-cfdi-xml` y `adjuntar-xml-entrante`.
 *
 * Reglas (fail-CLOSED):
 *  1. Membresía de organización (si no hay, 403 sin revelar detalles).
 *  2. Rol con permiso de captura CxP (`ROLES_CAPTURA_CXP`).
 *  3. Rate limit persistente por usuario y por organización vía RPC
 *     `check_ratelimit`; si el contador no está disponible se corta con 503.
 */
import { errorResponse, jsonResponse } from "./response.ts";
import { authorizeOrgRole, ROLES_CAPTURA_CXP, type AuthContext } from "./auth.ts";
import type { createLogger } from "./logger.ts";
import { captureEdgeException } from "./sentry.ts";

type Log = ReturnType<typeof createLogger>;
type Cors = Record<string, string>;

export interface TopeRateLimit {
  windowSeconds: number;
  max: number;
}

export interface OpcionesCxpGuard {
  /** Nombre de la función (prefijo de las llaves de rate limit y de Sentry). */
  fn: string;
  /** Tope por usuario. Omitir para no aplicarlo. */
  rlUsuario?: TopeRateLimit;
  /** Tope por organización. Omitir para no aplicarlo. */
  rlOrg?: TopeRateLimit;
  /** Mensaje del 429 (español, sin detalles internos). */
  mensaje429?: string;
}

export type ResultadoCxpGuard =
  | { ok: true; orgId: string }
  | { ok: false; res: Response };

/** Rate limit fail-CLOSED vía RPC `check_ratelimit`. */
async function checkRateLimit(
  ctx: { auth: AuthContext; cors: Cors; log: Log; fn: string; mensaje429: string },
  llave: string,
  tope: TopeRateLimit,
): Promise<Response | null> {
  const { auth, cors, log, fn, mensaje429 } = ctx;
  const { data: rl, error: rlErr } = await auth.adminClient.rpc("check_ratelimit", {
    p_key: llave,
    p_window_seconds: tope.windowSeconds,
    p_max: tope.max,
  });
  if (rlErr) {
    await captureEdgeException(new Error(`check_ratelimit failed: ${rlErr.message}`), {
      fn,
      status_code: 503,
      extra: { llave },
    });
    log.finish(503, "rate_limit_unavailable", { user_id: auth.userId });
    return errorResponse("rate_limit_unavailable", 503, cors);
  }
  const rlResult = rl as { ok?: boolean; retry_after?: number } | null;
  if (rlResult?.ok === false) {
    log.finish(429, "rate_limited", { user_id: auth.userId, payload: { llave } });
    return jsonResponse({ error: mensaje429 }, 429, {
      ...cors,
      "Retry-After": String(rlResult.retry_after ?? tope.windowSeconds),
    });
  }
  return null;
}

/**
 * Exige membresía de organización + rol de captura CxP y aplica los topes de
 * uso. Devuelve la organización efectiva, o la `Response` de rechazo.
 */
export async function autorizarCxp(
  auth: AuthContext,
  cors: Cors,
  log: Log,
  opts: OpcionesCxpGuard,
): Promise<ResultadoCxpGuard> {
  const { data: membership } = await auth.adminClient
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", auth.userId)
    .limit(1)
    .maybeSingle();
  const orgId = (membership as { organization_id?: string } | null)?.organization_id;
  if (!orgId) {
    log.finish(403, "no_membership", { user_id: auth.userId });
    return { ok: false, res: errorResponse("Tu usuario no pertenece a ninguna organización", 403, cors) };
  }

  const okRol = await authorizeOrgRole(auth.adminClient, auth.userId, orgId, ROLES_CAPTURA_CXP);
  if (!okRol) {
    log.finish(403, "forbidden_role", { user_id: auth.userId, organization_id: orgId });
    return { ok: false, res: errorResponse("Requiere un rol con permiso de captura CxP", 403, cors) };
  }

  const ctx = {
    auth, cors, log,
    fn: opts.fn,
    mensaje429: opts.mensaje429 ?? "Demasiadas solicitudes. Intenta más tarde.",
  };
  if (opts.rlUsuario) {
    const rechazo = await checkRateLimit(ctx, `${opts.fn}:user:${auth.userId}`, opts.rlUsuario);
    if (rechazo) return { ok: false, res: rechazo };
  }
  if (opts.rlOrg) {
    const rechazo = await checkRateLimit(ctx, `${opts.fn}:org:${orgId}`, opts.rlOrg);
    if (rechazo) return { ok: false, res: rechazo };
  }
  return { ok: true, orgId };
}
