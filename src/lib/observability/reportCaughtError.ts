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

export function reportCaughtError(
  err: unknown,
  tags: ReportTags,
  extra?: ReportExtra,
): void {
  const ctx = getErrorContext();
  const classified = classifyError(err);

  const enrichedTags: Record<string, string> = {
    ...(tags as Record<string, string>),
    organization_id: ctx.organizationId ?? "none",
    effective_role: ctx.effectiveRole ?? "none",
    route: ctx.route ?? "unknown",
    app_version: ctx.appVersion,
    error_kind: classified.kind,
  };
  if (classified.pgCode) enrichedTags.pg_code = classified.pgCode;

  const enrichedExtra: Record<string, unknown> = { ...(extra ?? {}) };
  if (extra && "payload" in extra && extra.payload !== undefined) {
    enrichedExtra.payload = sanitizePayload(extra.payload);
  }
  if (classified.pgHint) enrichedExtra.pg_hint = classified.pgHint;
  if (classified.pgDetails) enrichedExtra.pg_details = classified.pgDetails;
  if (ctx.organizationName) enrichedExtra.organization_name = ctx.organizationName;

  void import("@sentry/react")
    .then(({ captureException }) => {
      try {
        captureException(err, { tags: enrichedTags, extra: enrichedExtra });
      } catch {
        // best-effort
      }
    })
    .catch(() => undefined);
}
