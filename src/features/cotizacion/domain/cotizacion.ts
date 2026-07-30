/**
 * Reglas de dominio puras para Cotizaciones.
 * Sin dependencias de Supabase, React Query ni UI.
 * Implementaciones extraídas a módulos hermanos; se re-exportan aquí para
 * no romper consumidores existentes.
 */
export { buildConceptosFromCostos } from "./cotizacion.conceptos";

export type { CotizacionCostoLike } from "./cotizacion.conversion";
export {
  filtrarCostosParaContenedor, mapCostosACostosEmbarque, calcularFechaVigencia,
} from "./cotizacion.conversion";

export { accionesCotizacionPermitidas } from "./cotizacion.acciones";
