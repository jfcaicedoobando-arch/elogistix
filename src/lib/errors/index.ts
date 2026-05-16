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
  const raw =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "Error desconocido";
  for (const { match, message } of FRIENDLY_ERROR_MESSAGES) {
    if (match.test(raw)) return message;
  }
  return raw;
}
