/**
 * Barrel del dominio Cotizaciones (folder-style).
 * La implementación vive en `./crud`, `./costos`, `./conversiones`, `./wizard`,
 * y la lógica pura en `@/lib/domain/cotizacion`.
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
} from "./crud";

// Costos
export {
  fetchCotizacionCostos,
  upsertCotizacionCostos,
  fetchCotizacionCostosForEmbarque,
} from "./costos";
export type { CotizacionCostoLookup } from "./costos";

// Conversiones (duplicar / prospecto→cliente / cotización→embarques / portal)
export {
  duplicarCotizacion,
  convertirProspectoACliente,
  convertirCotizacionAEmbarques,
  portalResponderCotizacion,
} from "./conversiones";
export type { ProspectoAClienteInput } from "./conversiones";

// Wizard (orquestadores de pasos)
export { savePaso1, savePaso2, savePaso3, savePasoFinal } from "./wizard";

// Lógica pura del dominio (re-exportada por compatibilidad; preferir importar desde lib/domain/cotizacion)
export { buildConceptosFromCostos } from "@/lib/domain/cotizacion";
export type { ConceptoVentaPrellenado } from "@/lib/domain/cotizacion";
