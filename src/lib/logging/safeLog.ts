/**
 * FIX-42 — Wrapper de logging que aplica `redact` antes de imprimir en consola
 * o notificar a Sentry. Preferir este helper sobre `console.warn/error` en
 * módulos que puedan tocar payloads con PII o tokens.
 */
import { redact } from "./redact";

type Ctx = Record<string, unknown> | undefined;

function emit(level: "warn" | "error", msg: string, ctx?: Ctx): void {
  const safeCtx = ctx ? redact(ctx) : undefined;
  if (safeCtx !== undefined) {
    console[level](msg, safeCtx);
  } else {
    console[level](msg);
  }
}

export const safeLog = {
  warn(msg: string, ctx?: Ctx): void {
    emit("warn", msg, ctx);
  },
  error(msg: string, ctx?: Ctx): void {
    emit("error", msg, ctx);
  },
};
