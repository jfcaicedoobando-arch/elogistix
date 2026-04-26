/**
 * Catálogo central de mensajes de validación del wizard "Nuevo Embarque" (v8.96.0).
 *
 * Único punto de verdad para textos de error mostrados al usuario. Cada mensaje
 * se identifica con una **clave estable** `<step>.<campo>.<regla>` y, opcionalmente,
 * acepta un objeto de parámetros para interpolar valores dinámicos (tamaños, ids…).
 *
 * Ventajas:
 *  - Imposible escribir variaciones del mismo error en distintos archivos.
 *  - Un solo lugar para ajustar tono o traducir.
 *  - Tipado fuerte (TS infiere las claves disponibles).
 *
 * Convenciones:
 *  - Formato: `Etiqueta del campo: razón.` (ya garantizado por `formatValidationMessage`).
 *  - Nombres en español MX, tuteo, sin signos de admiración.
 *  - Las claves son estructurales (no se traducen): siempre lowerCamelCase.
 */
import { formatValidationMessage } from "./embarqueWizardSchemas";

// ── Etiquetas de campos (única fuente de verdad) ──────────────────────
export const FIELD_LABELS = {
  // Paso 1 — Datos generales
  modo: "Modo de transporte",
  tipo: "Tipo de operación",
  clienteId: "Cliente",
  descripcionMercancia: "Descripción de mercancía",
  // Paso 2 — Ruta
  etd: "ETD",
  eta: "ETA",
  puertoOrigen: "Puerto de origen",
  puertoDestino: "Puerto de destino",
  naviera: "Naviera",
  tipoServicio: "Tipo de servicio",
  contenedor: "Contenedor",
  tipoContenedor: "Tipo de contenedor",
  aeropuertoOrigen: "Aeropuerto de origen",
  aeropuertoDestino: "Aeropuerto de destino",
  mawb: "MAWB",
  ciudadOrigen: "Ciudad de origen",
  ciudadDestino: "Ciudad de destino",
  transportista: "Transportista",
  // Paso 4 — Costos
  tipoCambioUSD: "Tipo de cambio USD",
  tipoCambioEUR: "Tipo de cambio EUR",
  conceptosVenta: "Conceptos de venta",
  conceptosCosto: "Conceptos de costo",
} as const;

export type FieldKey = keyof typeof FIELD_LABELS;

// ── Catálogo de razones por clave ─────────────────────────────────────
// La clave es `<step>.<campo>.<regla>` (estable). El valor puede ser string
// o función que recibe parámetros y retorna string.
type ReasonValue = string | ((params: Record<string, unknown>) => string);

const REASONS: Record<string, { field: FieldKey | string; reason: ReasonValue }> = {
  // ─── Paso 1: datos generales ────────────────────────────────────────
  "1.modo.required": { field: "modo", reason: "selecciona una opción" },
  "1.tipo.required": { field: "tipo", reason: "selecciona una opción" },
  "1.clienteId.required": { field: "clienteId", reason: "selecciona uno del catálogo" },
  "1.descripcionMercancia.required": { field: "descripcionMercancia", reason: "campo obligatorio" },
  "1.descripcionMercancia.maxLength": { field: "descripcionMercancia", reason: "máximo 500 caracteres" },

  // ─── Paso 2: ruta ───────────────────────────────────────────────────
  "2.etd.required": { field: "etd", reason: "campo obligatorio" },
  "2.eta.required": { field: "eta", reason: "campo obligatorio" },
  "2.eta.afterEtd": { field: "eta", reason: "debe ser igual o posterior al ETD" },
  // marítimo
  "2.puertoOrigen.required": { field: "puertoOrigen", reason: "selecciona uno del catálogo" },
  "2.puertoDestino.required": { field: "puertoDestino", reason: "selecciona uno del catálogo" },
  "2.naviera.required": { field: "naviera", reason: "selecciona una opción" },
  "2.tipoServicio.required": { field: "tipoServicio", reason: "selecciona FCL o LCL" },
  "2.contenedor.required": { field: "contenedor", reason: "campo obligatorio" },
  "2.tipoContenedor.required": { field: "tipoContenedor", reason: "selecciona una opción" },
  // aéreo
  "2.aeropuertoOrigen.required": { field: "aeropuertoOrigen", reason: "campo obligatorio" },
  "2.aeropuertoDestino.required": { field: "aeropuertoDestino", reason: "campo obligatorio" },
  "2.mawb.required": { field: "mawb", reason: "campo obligatorio" },
  // terrestre
  "2.ciudadOrigen.required": { field: "ciudadOrigen", reason: "campo obligatorio" },
  "2.ciudadDestino.required": { field: "ciudadDestino", reason: "campo obligatorio" },
  "2.transportista.required": { field: "transportista", reason: "campo obligatorio" },

  // ─── Paso 3: documentos (etiqueta dinámica por nombre de doc) ───────
  "3.documento.tooLarge": {
    field: "documento",
    reason: ({ nombre, sizeMb, maxMb }) =>
      formatValidationMessage(`Documento ${nombre}`, `excede ${maxMb} MB (${sizeMb} MB)`),
  },
  "3.documento.invalidMime": {
    field: "documento",
    reason: ({ nombre }) =>
      formatValidationMessage(
        `Documento ${nombre}`,
        "formato no permitido. Usa PDF, JPG, PNG, XLSX o DOCX",
      ),
  },

  // ─── Paso 4: costos ─────────────────────────────────────────────────
  "4.tipoCambioUSD.positive": { field: "tipoCambioUSD", reason: "debe ser mayor a 0" },
  "4.tipoCambioEUR.positive": { field: "tipoCambioEUR", reason: "debe ser mayor a 0" },
  "4.conceptosVenta.required": {
    field: "conceptosVenta",
    reason: "agrega al menos uno con cantidad ≥ 1 y precio > 0",
  },
  "4.conceptosCosto.required": {
    field: "conceptosCosto",
    reason: "agrega al menos uno con proveedor, concepto y monto ≥ 0",
  },
  "4.conceptoVenta.invalid": {
    field: "conceptosVenta",
    reason: ({ id }) =>
      formatValidationMessage(`Concepto de venta #${id}`, "cantidad ≥ 1 y precio ≥ 0"),
  },
  "4.conceptoCosto.negativeAmount": {
    field: "conceptosCosto",
    reason: ({ id }) =>
      formatValidationMessage(`Concepto de costo #${id}`, "monto no puede ser negativo"),
  },
} as const;

export type MessageKey = keyof typeof REASONS;

/**
 * Devuelve el mensaje formateado para una clave del catálogo.
 *
 * @example
 *   getMessage("2.eta.afterEtd");          // "ETA: debe ser igual o posterior al ETD."
 *   getMessage("3.documento.tooLarge", { nombre: "BL", sizeMb: "12.4", maxMb: 10 });
 */
export function getMessage(key: MessageKey, params?: Record<string, unknown>): string {
  const entry = REASONS[key];
  if (!entry) {
    // En desarrollo, alertar; en runtime devolver la clave para no romper UI.
    if (typeof console !== "undefined") {
      console.warn(`[errorCatalog] Clave desconocida: ${key}`);
    }
    return key;
  }
  if (typeof entry.reason === "function") {
    // Las funciones ya devuelven el mensaje completo formateado.
    return entry.reason(params ?? {});
  }
  const label = FIELD_LABELS[entry.field as FieldKey] ?? entry.field;
  return formatValidationMessage(label, entry.reason);
}

/**
 * Versión segura para uso en `.refine()` de Zod, donde no hay parámetros.
 */
export function msg(key: MessageKey): string {
  return getMessage(key);
}

/**
 * Lista de todas las claves disponibles. Útil para tests de cobertura.
 */
export const ALL_MESSAGE_KEYS = Object.keys(REASONS) as MessageKey[];
