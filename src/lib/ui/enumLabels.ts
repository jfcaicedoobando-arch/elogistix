/**
 * FIX 6 (P3) — Etiquetas legibles para valores crudos de enum.
 *
 * En varios lugares (badges, bitácora, timelines) llegaba a la UI el valor tal
 * cual está guardado en la base: `importacion`, `maritimo`, `en_transito`…
 * Este módulo lo convierte a es-MX con acentos y espacios.
 *
 * Función pura y sin dependencias: se puede usar desde cualquier capa.
 */

/** Traducciones explícitas (acentos y mayúsculas de negocio). */
const ETIQUETAS: Record<string, string> = {
  importacion: "Importación",
  exportacion: "Exportación",
  nacional: "Nacional",
  cross_trade: "Cross Trade",
  intra_usa: "Intra USA",
  maritimo: "Marítimo",
  aereo: "Aéreo",
  terrestre: "Terrestre",
  multimodal: "Multimodal",
  fcl: "FCL",
  lcl: "LCL",
  cotizacion: "Cotización",
  borrador: "Borrador",
  confirmado: "Confirmado",
  en_transito: "En tránsito",
  llegada: "Llegada",
  en_proceso: "En proceso",
  por_liquidar: "Por liquidar",
  cerrado: "Cerrado",
  en_aduana: "En aduana",
  entregado: "Entregado",
  cancelado: "Cancelado",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
  enviada: "Enviada",
  solicitada: "Solicitada",
  vencida: "Vencida",
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  pagada: "Pagada",
  sin_cambios: "Sin cambios",
  sandbox: "Pruebas",
  live: "Producción",
};

/** ¿El texto parece un valor crudo de enum (slug en minúsculas)? */
export function pareceEnumCrudo(valor: string): boolean {
  return /^[a-z][a-z0-9]*(_[a-z0-9]+)*$/.test(valor.trim());
}

/**
 * Devuelve la etiqueta es-MX de un valor de enum. Si el valor ya viene
 * capitalizado/acentuado desde la base (p. ej. "Importación"), se respeta.
 */
export function humanizarEnum(valor: string | null | undefined): string {
  if (valor === null || valor === undefined) return "";
  const base = String(valor).trim();
  if (!base) return "";
  if (!pareceEnumCrudo(base)) return base;

  const directa = ETIQUETAS[base];
  if (directa) return directa;

  const texto = base.replace(/_/g, " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}
