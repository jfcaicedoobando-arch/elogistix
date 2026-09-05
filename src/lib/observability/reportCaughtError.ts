/**
 * Helper para reportar errores capturados en `try/catch` manuales a Sentry,
 * enriquecidos automáticamente con contexto ambiental (tenant, route,
 * clasificación del error y payload sanitizado).
 *
 * Uso típico:
 *
 *   try { ... } catch (err) {
 *     toast.error("Algo salió mal");
 *     reportCaughtError(
 *       err,
 *       { feature: "facturacion", op: "set_facturapi_api_key" },
 *       { payload: { ambiente, last4 } },
 *     );
 *   }
 *
 * `reportCaughtError` agrega siempre:
 *   - tags: organization_id, effective_role, route, app_version, error_kind,
 *     pg_code (cuando aplica).
 *   - contexts: payload sanitizado, pg_hint, pg_details, organization_name,
 *     request_id.
 *
 * 13.141.8 — auditoría Sentry.
 */
import { classifyError } from "./classifyError";
import { getErrorContext } from "./errorContextStore";
import { sanitizePayload } from "./sanitizePayload";

export interface ReportTags {
  /** Dominio funcional. Ejemplos: facturacion, tesoreria, cotizacion, pnl. */
  feature: string;
  /** Operación específica dentro del feature. */
  op?: string;
  /** Otros tags opcionales — convierten a string en Sentry. */
  [key: string]: string | undefined;
}

export interface ReportExtra {
  /** Payload de la operación (args RPC, body del fetch). Se sanitiza. */
  payload?: unknown;
  /** Correlation ID si el backend lo devolvió. */
  requestId?: string;
  /** Cualquier otra metadata libre. */
  [key: string]: unknown;
}

/**
 * Códigos de Postgres que representan validaciones de negocio esperadas
 * (ya se muestran al usuario vía toast). No son bugs — no llegan a Sentry.
 *   - 23514: check constraint (ej. "requiere cotización aceptada").
 */
const EXPECTED_PG_CODES = new Set(["23514"]);

/**
 * Clases de error de dominio lanzadas intencionalmente por servicios (validaciones
 * de negocio ya presentadas al usuario vía toast). No son bugs. Ver Sentry
 * JAVASCRIPT-REACT-37 / -3D (13.308.6).
 */
const BUSINESS_ERROR_NAMES = new Set<string>([
  "AprobacionFacturaError",
  "CreditLimitError",
  "ValidationError",
  "ZodError",
  // Sentry -61/-62: guardas de negocio del cliente (vigencia, monedas).
  "ReglaNegocioError",
]);

/**
 * Errores lanzados desde funciones/triggers de BD con `RAISE EXCEPTION 'LC_…'`
 * son parte del contrato de dominio (máquinas de estado, guardas fiscales,
 * bloqueos de eliminación). La UI ya muestra un toast contextual — se
 * descartan de Sentry para evitar ruido. Ver mem plan Sentry 13.302.7.
 */
function isExpectedBusinessError(
  pgCode: string | undefined,
  message: string | undefined,
  errName?: string,
): boolean {
  if (errName && BUSINESS_ERROR_NAMES.has(errName)) return true;
  if (pgCode && EXPECTED_PG_CODES.has(pgCode)) return true;
  // Sentry -60: los códigos LC_* son contrato de dominio con cualquier
  // ERRCODE (P0001, 22023, …); el prefijo del mensaje es la señal confiable.
  if (typeof message === "string" && message.startsWith("LC_")) return true;
  return false;
}

/** Convierte cualquier `unknown` en un Error real para que Sentry
 *  agrupe por mensaje en vez de mostrar el título minificado
 *  "Object captured as exception with keys". */
function toError(err: unknown): { error: Error; original: unknown } {
  if (err instanceof Error) return { error: err, original: undefined };
  const msg =
    (err as { message?: unknown } | null | undefined)?.message;
  const text = typeof msg === "string" && msg.length > 0 ? msg : "unknown error";
  return { error: new Error(text), original: err };
}


function buildEnrichedTags(
  tags: ReportTags,
  ctx: ReturnType<typeof getErrorContext>,
  classified: ReturnType<typeof classifyError>,
): Record<string, string> {
  const enriched: Record<string, string> = {
    ...(tags as Record<string, string>),
    organization_id: ctx.organizationId ?? "none",
    effective_role: ctx.effectiveRole ?? "none",
    route: ctx.route ?? "unknown",
    app_version: ctx.appVersion,
    error_kind: classified.kind,
  };
  if (classified.pgCode) enriched.pg_code = classified.pgCode;
  return enriched;
}

function buildEnrichedExtra(
  extra: ReportExtra | undefined,
  ctx: ReturnType<typeof getErrorContext>,
  classified: ReturnType<typeof classifyError>,
): Record<string, unknown> {
  const enriched: Record<string, unknown> = { ...(extra ?? {}) };
  if (extra && "payload" in extra && extra.payload !== undefined) {
    enriched.payload = sanitizePayload(extra.payload);
  }
  if (classified.pgHint) enriched.pg_hint = classified.pgHint;
  if (classified.pgDetails) enriched.pg_details = classified.pgDetails;
  if (ctx.organizationName) enriched.organization_name = ctx.organizationName;
  return enriched;
}

export function reportCaughtError(
  err: unknown,
  tags: ReportTags,
  extra?: ReportExtra,
): void {
  const ctx = getErrorContext();
  const classified = classifyError(err);

  // Skip: validaciones de negocio esperadas (mem plan Sentry 13.302.7 + 13.308.6).
  // v13.792.1 — defensa en profundidad: cualquier error marcado `expected: true`
  // (p. ej. BuzonDuplicadoError) nunca llega a Sentry aunque otra ruta lo llame.
  if ((err as { expected?: unknown } | null | undefined)?.expected === true) return;
  const errMessage = (err as { message?: unknown } | null | undefined)?.message;
  const errName = (err as { name?: unknown } | null | undefined)?.name;
  if (isExpectedBusinessError(
    classified.pgCode,
    typeof errMessage === "string" ? errMessage : undefined,
    typeof errName === "string" ? errName : undefined,
  )) return;

  const enrichedTags = buildEnrichedTags(tags, ctx, classified);
  const enrichedExtra = buildEnrichedExtra(extra, ctx, classified);

  const { error, original } = toError(err);
  if (original !== undefined) enrichedExtra.original = original;

  void import("@sentry/react")
    .then(({ captureException }) => {
      try {
        captureException(error, { tags: enrichedTags, extra: enrichedExtra });
      } catch {
        // best-effort
      }
    })
    .catch(() => undefined);
}

