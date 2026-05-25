/**
 * Logger ligero y centralizado.
 *
 * - `debug`/`info`: sólo se imprimen fuera de producción.
 * - `warn`: siempre va a consola (con prefijo).
 * - `error`: a consola + reporta a `app_logs` vía `logClientError` (fire-and-forget).
 *
 * Reemplaza llamadas directas a `console.warn|error` en código productivo.
 */
import { logClientError } from "@/services/observability/logClientError";

const isProd =
  typeof import.meta !== "undefined" && import.meta.env?.MODE === "production";

function fmt(scope: string, args: unknown[]): unknown[] {
  return [`[${scope}]`, ...args];
}

export const logger = {
  debug(scope: string, ...args: unknown[]): void {
    if (isProd) return;
     
    console.debug(...fmt(scope, args));
  },
  info(scope: string, ...args: unknown[]): void {
    if (isProd) return;
     
    console.info(...fmt(scope, args));
  },
  warn(scope: string, ...args: unknown[]): void {
     
    console.warn(...fmt(scope, args));
  },
  error(scope: string, ...args: unknown[]): void {
     
    console.error(...fmt(scope, args));
    try {
      const first = args.find((a) => a instanceof Error) as Error | undefined;
      const message = first?.message ?? String(args[0] ?? "unknown error");
      logClientError({
        message: `[${scope}] ${message}`,
        stack: first?.stack,
      });
    } catch {
      // nunca propagar desde el logger
    }
  },
};
