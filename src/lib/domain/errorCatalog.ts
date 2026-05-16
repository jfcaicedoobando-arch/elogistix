/**
 * Catálogo central de mensajes de error para el wizard de embarques.
 *
 * Cada mensaje se identifica con una clave estable `<step>.<campo>.<regla>`
 * (ej. `2.eta.afterEtd`, `3.documento.tooLarge`). Centraliza tono, ortografía
 * y traducciones futuras: cualquier ajuste se hace en un único lugar.
 *
 * API:
 *   - `msg(key)`           → string estático (uso típico en `z.string().min(1, msg(...))`)
 *   - `getMessage(key, p)` → string con interpolación (para mensajes dinámicos
 *     con parámetros tipados, ej. tamaño de archivo, IDs, nombres).
 */
import { formatValidationMessage } from "./validationFormat";

// ── Etiquetas legibles de campos ───────────────────────────────────────
export const FIELD_LABELS = {
  modo: "Modo de transporte",
  tipo: "Tipo de operación",
  cliente: "Cliente",
  descripcion: "Descripción de mercancía",
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
  tcUSD: "Tipo de cambio USD",
  tcEUR: "Tipo de cambio EUR",
  ventas: "Conceptos de venta",
  costos: "Conceptos de costo",
} as const;

// ── Diccionario estático ───────────────────────────────────────────────
const STATIC: Record<string, string> = {
  // Paso 1
  "1.modo.required": formatValidationMessage(FIELD_LABELS.modo, "selecciona una opción"),
  "1.tipo.required": formatValidationMessage(FIELD_LABELS.tipo, "selecciona una opción"),
  "1.clienteId.required": formatValidationMessage(FIELD_LABELS.cliente, "selecciona uno del catálogo"),
  "1.descripcion.required": formatValidationMessage(FIELD_LABELS.descripcion, "campo obligatorio"),
  "1.descripcion.maxLen": formatValidationMessage(FIELD_LABELS.descripcion, "máximo 500 caracteres"),

  // Paso 2 — comunes
  "2.etd.required": formatValidationMessage(FIELD_LABELS.etd, "campo obligatorio"),
  "2.eta.required": formatValidationMessage(FIELD_LABELS.eta, "campo obligatorio"),
  "2.eta.afterEtd": formatValidationMessage(FIELD_LABELS.eta, "debe ser igual o posterior al ETD"),

  // Paso 2 — marítimo
  "2.puertoOrigen.required": formatValidationMessage(FIELD_LABELS.puertoOrigen, "selecciona uno del catálogo"),
  "2.puertoDestino.required": formatValidationMessage(FIELD_LABELS.puertoDestino, "selecciona uno del catálogo"),
  "2.naviera.required": formatValidationMessage(FIELD_LABELS.naviera, "selecciona una opción"),
  "2.tipoServicio.required": formatValidationMessage(FIELD_LABELS.tipoServicio, "selecciona FCL o LCL"),
  "2.contenedor.required": formatValidationMessage(FIELD_LABELS.contenedor, "campo obligatorio"),
  "2.tipoContenedor.required": formatValidationMessage(FIELD_LABELS.tipoContenedor, "selecciona una opción"),

  // Paso 2 — aéreo
  "2.aeropuertoOrigen.required": formatValidationMessage(FIELD_LABELS.aeropuertoOrigen, "campo obligatorio"),
  "2.aeropuertoDestino.required": formatValidationMessage(FIELD_LABELS.aeropuertoDestino, "campo obligatorio"),
  "2.mawb.required": formatValidationMessage(FIELD_LABELS.mawb, "campo obligatorio"),

  // Paso 2 — terrestre
  "2.ciudadOrigen.required": formatValidationMessage(FIELD_LABELS.ciudadOrigen, "campo obligatorio"),
  "2.ciudadDestino.required": formatValidationMessage(FIELD_LABELS.ciudadDestino, "campo obligatorio"),
  "2.transportista.required": formatValidationMessage(FIELD_LABELS.transportista, "campo obligatorio"),

  // Paso 4
  "4.tcUSD.positive": formatValidationMessage(FIELD_LABELS.tcUSD, "debe ser mayor a 0"),
  "4.tcEUR.positive": formatValidationMessage(FIELD_LABELS.tcEUR, "debe ser mayor a 0"),
  "4.ventas.minOne": formatValidationMessage(
    FIELD_LABELS.ventas,
    "agrega al menos uno con cantidad ≥ 1 y precio > 0",
  ),
  "4.costos.minOne": formatValidationMessage(
    FIELD_LABELS.costos,
    "agrega al menos uno con proveedor, concepto y monto ≥ 0",
  ),
};

// ── Diccionario dinámico (con parámetros) ─────────────────────────────
const DYNAMIC = {
  "3.documento.tooLarge": (p: { nombre: string; sizeMb: string; maxMb: number }) =>
    formatValidationMessage(`Documento ${p.nombre}`, `excede ${p.maxMb} MB (${p.sizeMb} MB)`),
  "3.documento.badFormat": (p: { nombre: string }) =>
    formatValidationMessage(
      `Documento ${p.nombre}`,
      "formato no permitido. Usa PDF, JPG, PNG, XLSX o DOCX",
    ),
  "4.venta.invalid": (p: { id: number }) =>
    formatValidationMessage(`Concepto de venta #${p.id}`, "cantidad ≥ 1 y precio ≥ 0"),
  "4.costo.invalid": (p: { id: number }) =>
    formatValidationMessage(`Concepto de costo #${p.id}`, "monto no puede ser negativo"),
} as const;

export type DynamicErrorKey = keyof typeof DYNAMIC;

/** Devuelve el mensaje estático para una clave; si no existe, devuelve la clave como fallback. */
export function msg(key: string): string {
  return STATIC[key] ?? key;
}

/** Devuelve el mensaje dinámico interpolado con los parámetros tipados. */
export function getMessage<K extends DynamicErrorKey>(
  key: K,
  params: Parameters<(typeof DYNAMIC)[K]>[0],
): string {
  const fn = DYNAMIC[key] as (p: unknown) => string;
  return fn(params);
}
