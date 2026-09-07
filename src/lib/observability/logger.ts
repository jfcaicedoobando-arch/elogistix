/**
 * Logger ligero y centralizado.
 *
 * - `debug`/`info`: sólo se imprimen fuera de producción.
 * - `warn`: siempre va a consola (con prefijo).
 * - `error`: a consola + reporta a `app_logs` vía `logClientError` + Sentry
 *   (`captureException`) en producción para que cualquier `logger.error(...)`
 *   distribuido en el código (PDFs, RPCs, servicios) llegue a Sentry sin tocar
 *   call sites. Carga dinámica de `@sentry/react` para no romper el code-split.
 *
 * Reemplaza llamadas directas a `console.warn|error` en código productivo.
 */
import { logClientError } from "@/services/observability/logClientError";

const isProd =
  typeof import.meta !== "undefined" && import.meta.env?.MODE === "production";

function fmt(scope: string, args: unknown[]): unknown[] {
  return [`[${scope}]`, ...args];
}

/** Reporta a Sentry en producción, perezosamente (no añade peso al chunk crítico). */
function reportToSentry(scope: string, err: Error, extra?: Record<string, string>): void {
  if (!isProd) return;
  void import("@sentry/react")
    .then((Sentry) => {
      Sentry.captureException(err, {
        tags: { scope, source: "logger" },
        ...(extra && Object.keys(extra).length > 0 ? { extra } : {}),
      });
    })
    .catch(() => {
      // Sentry es best-effort; un fallo al cargarlo no debe romper la app.
    });
}

interface ErrorPlanoLike {
  message?: unknown;
  code?: unknown;
  details?: unknown;
  hint?: unknown;
}

/**
 * Errores del backend (PostgrestError, FunctionsHttpError serializado) son
 * objetos planos, no `Error`. Antes se convertían con `String(...)` y llegaban
 * a Sentry como `[object Object]` (JAVASCRIPT-REACT-69), sin mensaje ni código
 * accionables. Aquí se extrae el mensaje y se conservan `code`/`details`/`hint`
 * como contexto plano del evento.
 */
function describirErrorPlano(
  arg: unknown,
): { message: string; extra: Record<string, string> } | null {
  if (typeof arg !== "object" || arg === null || arg instanceof Error) return null;
  const e = arg as ErrorPlanoLike;
  const msg = typeof e.message === "string" && e.message.length > 0 ? e.message : null;
  const code = typeof e.code === "string" || typeof e.code === "number" ? String(e.code) : null;
  if (!msg && !code) return null;
  const extra: Record<string, string> = {};
  if (code) extra.pg_code = code;
  if (typeof e.details === "string" && e.details) extra.pg_details = e.details;
  if (typeof e.hint === "string" && e.hint) extra.pg_hint = e.hint;
  return { message: msg ?? `error sin mensaje (código ${code})`, extra };
}


/**
 * 13.114.17: añade breadcrumb a Sentry para `info`/`warn` en prod, así los
 * errores capturados llegan con el historial de pasos que el desarrollador
 * registró con el logger. Carga dinámica + try/catch silencioso.
 */
function addSentryBreadcrumb(level: "info" | "warning", scope: string, args: unknown[]): void {
  if (!isProd) return;
  void import("@sentry/react")
    .then((Sentry) => {
      const message = args
        .map((a) => (typeof a === "string" ? a : JSON.stringify(a)))
        .join(" ")
        .slice(0, 500);
      Sentry.addBreadcrumb({ category: scope, level, message });
    })
    .catch(() => {
      // best-effort
    });
}

export const logger = {
  debug(scope: string, ...args: unknown[]): void {
    if (isProd) return;
     
    console.debug(...fmt(scope, args));
  },
  info(scope: string, ...args: unknown[]): void {
    if (isProd) {
      addSentryBreadcrumb("info", scope, args);
      return;
    }
     
    console.info(...fmt(scope, args));
  },
  warn(scope: string, ...args: unknown[]): void {
    addSentryBreadcrumb("warning", scope, args);
     
    console.warn(...fmt(scope, args));
  },
  error(scope: string, ...args: unknown[]): void {
     
    console.error(...fmt(scope, args));
    try {
      const firstError = args.find((a) => a instanceof Error) as Error | undefined;
      const plano = firstError ? null : args.map(describirErrorPlano).find(Boolean) ?? null;
      const message =
        firstError?.message ?? plano?.message ?? String(args[0] ?? "unknown error");
      // Conservar stack: si no vino Error, sintetizar uno para Sentry.
      const errForSentry = firstError ?? new Error(message);
      logClientError({
        message: `[${scope}] ${message}`,
        stack: errForSentry.stack,
      });
      reportToSentry(scope, errForSentry, plano?.extra);
    } catch {

      // nunca propagar desde el logger
    }
  },
};

