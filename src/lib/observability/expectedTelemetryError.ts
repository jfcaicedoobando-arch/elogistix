/** Only explicit domain validations are silent; SQLSTATE alone is not intent. */
const DOMAIN_NAMES = new Set([
  "AprobacionFacturaError", "CreditLimitError", "ValidationError", "ZodError",
  "ReglaNegocioError", "BuzonDuplicadoError",
]);
const DOMAIN_CODES = /\bLC_(?:COT_TRANSICION_INVALIDA|TRANSICION_INVALIDA|CONFLICTO_CONCURRENCIA|(?:CRM_)?MONEDA_INCOMPATIBLE)\b/;
const KNOWN_MESSAGES = [
  "ya está registrado en este embarque", "verifica el uuid en el sat",
  "factura duplicada", "no puedes aprobar o rechazar esta factura",
  "embarque cerrado: usa reabrir_embarque", "debe seleccionar al menos",
];

export function isExpectedTelemetryError(error: unknown): boolean {
  const e = (error ?? {}) as { expected?: unknown; code?: unknown; name?: unknown; message?: unknown; cause?: { expected?: unknown } };
  if (e.expected === false || e.cause?.expected === false) return false;
  if (e.expected === true) return true;
  if (typeof e.name === "string" && DOMAIN_NAMES.has(e.name)) return true;
  const message = typeof error === "string" ? error : typeof e.message === "string" ? e.message : "";
  if (DOMAIN_CODES.test(message)) return true;
  // Preserve routine permission denials without swallowing all 42501 failures.
  if (e.code === "42501" && /permission denied|row.level security policy|no tienes permisos/i.test(message)) return true;
  return KNOWN_MESSAGES.some((known) => message.toLowerCase().includes(known));
}

export function isOfflineTelemetryError(error: unknown): boolean {
  const e = error as { name?: unknown; message?: unknown; context?: { online?: unknown } } | undefined;
  if (e?.name === "AbortError") return true;
  const message = typeof e?.message === "string" ? e.message : "";
  const network = /failed to fetch|network|load failed|no se pudo conectar con el servidor/i.test(message);
  const offline = e?.context?.online === false || (typeof navigator !== "undefined" && navigator.onLine === false);
  return network && offline;
}
