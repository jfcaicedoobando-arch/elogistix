/** Only explicit domain validations are silent; SQLSTATE alone is not intent. */
const DOMAIN_NAMES = new Set([
  "AprobacionFacturaError", "CreditLimitError", "ValidationError", "ZodError",
  "ReglaNegocioError", "BuzonDuplicadoError",
]);
// LC_COSTO_VINCULADO_CXP (Sentry 7T): candado de costo ligado a factura de proveedor.
// LC_EMBARQUE_CERRADO: candado de cierre; el usuario ve el aviso y debe reabrir.
const DOMAIN_CODES = /\bLC_(?:COT_TRANSICION_INVALIDA|TRANSICION_INVALIDA|CONFLICTO_CONCURRENCIA|(?:CRM_)?MONEDA_INCOMPATIBLE|CREDITO_TC_INVALIDO|COSTO_VINCULADO_CXP|EMBARQUE_CERRADO)\b/;
// Guards de datos (Sentry 7Q/77): el usuario ve el mensaje; no es falla de código.
const KNOWN_MESSAGES = [
  "ya está registrado en este embarque", "verifica el uuid en el sat",
  "factura duplicada", "no puedes aprobar o rechazar esta factura",
  "embarque cerrado: usa reabrir_embarque", "debe seleccionar al menos",
  "no coinciden con el resumen del proveedor de timbrado",
  // Sentry 8C: contenedor repetido; la UI muestra el aviso de pgConstraintMessages.
  "unique constraint \"contenedores_numero_unico\"",
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
