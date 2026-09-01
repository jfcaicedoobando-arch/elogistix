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
import {
  type AuthContext,
  authorizeOrgRole,
  ROLES_CAPTURA_CXP,
} from "./auth.ts";
import type { createLogger } from "./logger.ts";
import { captureEdgeException } from "./sentry.ts";

type Log = ReturnType<typeof createLogger>;
type Cors = Record<string, string>;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface TopeRateLimit {
  windowSeconds: number;
  max: number;
}

export interface OpcionesCxpGuard {
  /** Organización objetivo explícita; nunca se infiere de la primera membresía. */
  organizationId: string;
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

type RateLimitResult = { ok: boolean; retry_after?: number };

function parseRateLimitResult(value: unknown): RateLimitResult | null {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const result = value as Record<string, unknown>;
  if (result.ok !== true && result.ok !== false) return null;
  if (result.ok === false && result.retry_after !== undefined) {
    if (
      typeof result.retry_after !== "number" ||
      !Number.isFinite(result.retry_after) || result.retry_after < 0
    ) {
      return null;
    }
  }
  return {
    ok: result.ok,
    ...(typeof result.retry_after === "number"
      ? { retry_after: result.retry_after }
      : {}),
  };
}

/** Rate limit fail-CLOSED vía RPC `check_ratelimit`. */
async function checkRateLimit(
  ctx: {
    auth: AuthContext;
    cors: Cors;
    log: Log;
    fn: string;
    mensaje429: string;
  },
  llave: string,
  tope: TopeRateLimit,
): Promise<Response | null> {
  const { auth, cors, log, fn, mensaje429 } = ctx;
  let rl: unknown;
  let rlErr: { message: string } | null;
  try {
    const respuesta = await auth.adminClient.rpc("check_ratelimit", {
      p_key: llave,
      p_window_seconds: tope.windowSeconds,
      p_max: tope.max,
    });
    rl = respuesta.data;
    rlErr = respuesta.error;
  } catch (error) {
    rlErr = {
      message: error instanceof Error ? error.message : "unknown error",
    };
  }
  if (rlErr) {
    await captureEdgeException(
      new Error(`check_ratelimit failed: ${rlErr.message}`),
      {
        fn,
        status_code: 503,
        extra: { llave },
      },
    );
    log.finish(503, "rate_limit_unavailable", { user_id: auth.userId });
    return errorResponse("rate_limit_unavailable", 503, cors);
  }
  const rlResult = parseRateLimitResult(rl);
  if (!rlResult) {
    await captureEdgeException(
      new Error("check_ratelimit returned an invalid response"),
      {
        fn,
        status_code: 503,
        extra: { llave },
      },
    );
    log.finish(503, "rate_limit_unavailable", { user_id: auth.userId });
    return errorResponse("rate_limit_unavailable", 503, cors);
  }
  if (rlResult.ok === false) {
    log.finish(429, "rate_limited", {
      user_id: auth.userId,
      payload: { llave },
    });
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
  const orgId = opts.organizationId;
  if (!UUID_RE.test(orgId)) {
    log.finish(400, "invalid_organization", { user_id: auth.userId });
    return {
      ok: false,
      res: errorResponse("organization_id inválido", 400, cors),
    };
  }

  const okRol = await authorizeOrgRole(
    auth.adminClient,
    auth.userId,
    orgId,
    ROLES_CAPTURA_CXP,
  );
  if (!okRol) {
    log.finish(403, "forbidden_role", {
      user_id: auth.userId,
      organization_id: orgId,
    });
    return {
      ok: false,
      res: errorResponse(
        "Requiere un rol con permiso de captura CxP",
        403,
        cors,
      ),
    };
  }

  const ctx = {
    auth,
    cors,
    log,
    fn: opts.fn,
    mensaje429: opts.mensaje429 ?? "Demasiadas solicitudes. Intenta más tarde.",
  };
  if (opts.rlUsuario) {
    const rechazo = await checkRateLimit(
      ctx,
      `${opts.fn}:user:${auth.userId}`,
      opts.rlUsuario,
    );
    if (rechazo) return { ok: false, res: rechazo };
  }
  if (opts.rlOrg) {
    const rechazo = await checkRateLimit(
      ctx,
      `${opts.fn}:org:${orgId}`,
      opts.rlOrg,
    );
    if (rechazo) return { ok: false, res: rechazo };
  }
  return { ok: true, orgId };
}
