/**
 * Barrel — `services/cotizacionServices` re-exporta toda la API pública del dominio Cotizaciones.
 * La implementación vive en `src/services/cotizacion/{crud,costos,conversiones,wizard}.ts`,
 * y la lógica pura en `src/lib/domain/cotizacion.ts`.
 *
 * Mantenemos este punto de importación por compatibilidad con consumidores existentes;
 * código nuevo puede importar directamente de `@/services/cotizacion/*` o `@/lib/domain/cotizacion`.
 */

// CRUD + queries
export {
  COTIZACION_LIST_COLUMNS,
  COTIZACION_ACEPTADA_COLUMNS,
  generarFolioCotizacion,
  fetchCotizaciones,
  fetchCotizacionesAceptadas,
  fetchCotizacionById,
  fetchEmbarquesVinculados,
  crearCotizacion,
  updateCotizacion,
  deleteCotizacion,
  updateEstadoCotizacion,
} from "./cotizacion/crud";

// Costos
export {
  fetchCotizacionCostos,
  upsertCotizacionCostos,
  fetchCotizacionCostosForEmbarque,
} from "./cotizacion/costos";
export type { CotizacionCostoLookup } from "./cotizacion/costos";

// Conversiones (duplicar / prospecto→cliente / cotización→embarques / portal)
export {
  duplicarCotizacion,
  convertirProspectoACliente,
  convertirCotizacionAEmbarques,
  portalResponderCotizacion,
} from "./cotizacion/conversiones";
export type { ProspectoAClienteInput } from "./cotizacion/conversiones";

// Wizard (orquestadores de pasos)
export { savePaso1, savePaso2, savePaso3, savePasoFinal } from "./cotizacion/wizard";

// Lógica pura del dominio (re-exportada por compatibilidad; preferir importar desde lib/domain/cotizacion)
export { buildConceptosFromCostos } from "@/lib/domain/cotizacion";
export type { ConceptoVentaPrellenado } from "@/lib/domain/cotizacion";
