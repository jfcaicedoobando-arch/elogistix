/**
 * Extracts a human-readable error message from an unknown caught value.
 * Also traduce códigos conocidos de Postgres/RPC a mensajes amigables para
 * el usuario final (A.4: snapshots inmutables).
 */
const FRIENDLY_ERROR_MESSAGES: Array<{ match: RegExp; message: string }> = [
  {
    match: /factura_inmutable/i,
    message:
      "Esta factura ya fue emitida y no puede modificarse. Para corregirla, emite una nota de crédito.",
  },
];

export function getErrorMessage(err: unknown): string {
  let raw = "Error desconocido";
  if (err instanceof Error) {
    raw = err.message || raw;
  } else if (typeof err === "string") {
    raw = err;
  } else if (err && typeof err === "object") {
    // PostgrestError u objetos similares (Supabase RPC, etc.) que NO heredan de Error
    const e = err as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown };
    const parts = [e.message, e.details, e.hint].filter(
      (v): v is string => typeof v === "string" && v.length > 0,
    );
    if (parts.length > 0) raw = parts.join(" — ");
    else if (typeof e.code === "string" && e.code.length > 0) raw = `Código ${e.code}`;
  }
  for (const { match, message } of FRIENDLY_ERROR_MESSAGES) {
    if (match.test(raw)) return message;
  }
  return raw;
}
