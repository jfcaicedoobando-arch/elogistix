/**
 * Reglas de dominio puras para Cotizaciones.
 * Sin dependencias de Supabase, React Query ni UI.
 * Implementaciones extraídas a módulos hermanos; se re-exportan aquí para
 * no romper consumidores existentes.
 */
export type { ConceptoVentaPrellenado } from "./cotizacion.conceptos";
export { buildConceptosFromCostos } from "./cotizacion.conceptos";

export type {
  CotizacionCostoLike, ConceptoCostoFromCotizacion,
} from "./cotizacion.conversion";
export {
  filtrarCostosParaContenedor, mapCostosACostosEmbarque, calcularFechaVigencia,
} from "./cotizacion.conversion";

export type {
  EstadoCotizacionAccion, AccionesCotizacionPermitidas,
} from "./cotizacion.acciones";
export { accionesCotizacionPermitidas } from "./cotizacion.acciones";
