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
function reportToSentry(scope: string, err: Error): void {
  if (!isProd) return;
  void import("@sentry/react")
    .then((Sentry) => {
      Sentry.captureException(err, { tags: { scope, source: "logger" } });
    })
    .catch(() => {
      // Sentry es best-effort; un fallo al cargarlo no debe romper la app.
    });
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
      const message = firstError?.message ?? String(args[0] ?? "unknown error");
      // Conservar stack: si no vino Error, sintetizar uno para Sentry.
      const errForSentry = firstError ?? new Error(message);
      logClientError({
        message: `[${scope}] ${message}`,
        stack: errForSentry.stack,
      });
      reportToSentry(scope, errForSentry);
    } catch {
      // nunca propagar desde el logger
    }
  },
};

