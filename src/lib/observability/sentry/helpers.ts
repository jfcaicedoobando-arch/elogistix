/**
 * Helpers puros de Sentry: detección de errores de HMR/React-Refresh y scrub
 * de PII sobre eventos. Separado de sentry.ts para mantener archivos ≤200 líneas.
 */
import type * as Sentry from "@sentry/react";
import { scrubPii, scrubUrl } from "@/lib/observability/piiScrub";

/** Detecta si un error proviene de React Refresh / HMR de Vite.
 *  Ocurre cuando un bundle stale intenta re-renderizar y referencia
 *  variables (hooks, estado) que ya no existen tras hot reload.
 *  Ejemplo: "ReferenceError: pendienteOpen is not defined". */
export function isReactRefreshHmrError(error: Error): boolean {
  if (!error.message?.includes("is not defined")) return false;
  const stack = error.stack ?? "";
  return /react-refresh|performReactRefresh|scheduleRefresh/i.test(stack);
}

/** Detecta stacktrace de React Refresh en frames de Sentry. */
export function isReactRefreshStackTrace(stacktrace: unknown): boolean {
  if (!stacktrace || typeof stacktrace !== "object") return false;
  const frames = (stacktrace as { frames?: Array<{ abs_path?: string; function?: string }> }).frames;
  if (!Array.isArray(frames)) return false;
  return frames.some(
    (f) =>
      f.abs_path?.includes("@react-refresh") ||
      f.function?.includes("performReactRefresh") ||
      f.function?.includes("scheduleRefresh"),
  );
}

/** Headers que NUNCA deben llegar a Sentry (tokens y cookies). */
const SENSITIVE_HEADERS = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "apikey",
  "x-supabase-auth",
  "x-supabase-api-key",
]);

/** Redacta headers sensibles en place (case-insensitive). */
function scrubHeaders(headers: Record<string, unknown> | undefined): void {
  if (!headers || typeof headers !== "object") return;
  for (const key of Object.keys(headers)) {
    if (SENSITIVE_HEADERS.has(key.toLowerCase())) {
      headers[key] = "[Filtered]";
    }
  }
}

/**
 * Aplica scrub de PII sobre un Sentry event (P3): recorta `event.user` a sólo
 * `{ id }`, redacta query strings sensibles en `event.request.url`, aplica
 * regex de RFC/CURP/email sobre `event.message` y `event.exception.values[*].value`,
 * y filtra headers/breadcrumbs sensibles. F5 (13.65.0): añade scrub de
 * `request.headers` y `breadcrumbs[].data.url`.
 */
function scrubBreadcrumb(b: { data?: unknown; message?: unknown }): void {
  const data = b.data as Record<string, unknown> | undefined;
  if (data) {
    for (const key of ["url", "to", "from"] as const) {
      const v = data[key];
      if (typeof v === "string") data[key] = scrubUrl(v);
    }
  }
  if (typeof b.message === "string") {
    b.message = scrubPii(b.message);
  }
}

export function scrubEventPii<T extends Sentry.ErrorEvent>(event: T): T {
  if (event.user) {
    event.user = { id: event.user.id };
  }
  if (event.request?.url) {
    event.request.url = scrubUrl(event.request.url);
  }
  scrubHeaders(event.request?.headers as Record<string, unknown> | undefined);
  if (typeof event.message === "string") {
    event.message = scrubPii(event.message);
  }
  const values = event.exception?.values;
  if (values) {
    for (const v of values) {
      if (typeof v.value === "string") v.value = scrubPii(v.value);
    }
  }
  // F5: limpiar URLs sensibles en breadcrumbs (navigation / ui.click / fetch / xhr).
  if (Array.isArray(event.breadcrumbs)) {
    for (const b of event.breadcrumbs) scrubBreadcrumb(b);
  }
  return event;
}

/**
 * 13.320.0 (audit Sentry Batch 1.b): agrupar errores de Postgres/PostgREST por
 * `code` SQL + ruta para que dos issues equivalentes no queden en grupos
 * separados. Un `PostgrestError` trae `code` (`23505`, `42501`, `P0001`, …) y
 * opcionalmente `hint`. Sin fingerprint explícito Sentry agrupa por `message`,
 * que suele incluir IDs volátiles.
 *
 * Devuelve un array de tokens estable o `null` si no aplica.
 */
export function computePostgrestFingerprint(
  exc: unknown,
  routePath: string | undefined,
): string[] | null {
  const err = exc as { code?: unknown; name?: unknown } | undefined;
  const code = typeof err?.code === "string" ? err.code : null;
  if (!code) return null;
  // Filtro barato: sólo códigos SQLSTATE (5 chars alfanuméricos) o PostgREST.
  if (!/^[A-Z0-9]{5}$/.test(code) && !code.startsWith("PGRST")) return null;
  const route = routePath ? routePath.replace(/\/[0-9a-f-]{8,}/gi, "/:id") : "unknown";
  return ["postgres", code, route];
}


const SAMPLE_RULES: ReadonlyArray<{ pattern: RegExp; rate: number }> = [
  // 0% — estáticas / marketing / dev
  { pattern: /^\/(landing|privacidad|terminos|guia|tracking)?\/?$/i, rate: 0 },
  { pattern: /^\/(legal|recursos)(\/|$)/i, rate: 0 },
  { pattern: /^\/dev(\/|$)/i, rate: 0 },
  // 100% — flujos críticos de negocio
  { pattern: /\/(embarques\/(nuevo|[^/]+\/editar)|cotizaciones\/nueva|facturas\/nueva|conciliacion)/i, rate: 1.0 },
  { pattern: /^\/(compras|costeo)/i, rate: 1.0 },
  { pattern: /^\/crm\/(leads|oportunidades)\//i, rate: 1.0 },
  { pattern: /^\/portal\/(embarques|cotizaciones|facturas)\/[^/]+/i, rate: 1.0 },
  // 50% — financieros / reportes / portal cliente / CRM general
  { pattern: /^\/crm/i, rate: 0.5 },
  { pattern: /^\/reportes/i, rate: 0.5 },
  { pattern: /^\/(profit|tesoreria|comisiones|cxc|cxp|cartera|proformas)/i, rate: 0.5 },
  { pattern: /^\/portal/i, rate: 0.5 },
  // 30% — auditoría / admin
  { pattern: /^\/(auditoria|admin)/i, rate: 0.3 },
  // 5% — dashboards y listados de alto volumen
  { pattern: /^\/(dashboard|embarques|clientes|proveedores)\/?$/i, rate: 0.05 },
  { pattern: /^\/inicio\/?$/i, rate: 0.05 },
];

/**
 * Sampling dinámico por ruta. Devuelve la probabilidad [0..1] de trazar la
 * transaction actual. Prioriza flujos críticos (edición/creación de embarques,
 * cotizaciones, facturas, conciliación) y minimiza listados y marketing.
 */
export function sampleByRoute(ctx: {
  name?: string;
  attributes?: Record<string, unknown>;
  location?: { pathname?: string };
}): number {
  const path =
    ctx.location?.pathname ??
    (typeof window !== "undefined" ? window.location.pathname : "") ??
    "";

  for (const rule of SAMPLE_RULES) {
    if (rule.pattern.test(path)) return rule.rate;
  }
  return 0.1;
}


