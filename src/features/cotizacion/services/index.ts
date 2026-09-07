/**
 * Barrel del dominio Cotizaciones (folder-style).
 * Convención: `queries` (lecturas) + `mutations` (escrituras) + subdominios
 * (`costos`, `conversiones`, `wizard`). La lógica pura vive en
 * `@/features/cotizacion/domain/cotizacion`.
 */

// Queries (lecturas)
export {
  
  
  
  fetchCotizaciones,
  fetchCotizacionesAceptadas,
  fetchCotizacionById,
  fetchEmbarquesVinculados,
  fetchCotizacionFolio,
  fetchCotizacionSello,
} from "./queries";

// Mutations (escrituras)
export {
  crearCotizacion,
  updateCotizacion,
  deleteCotizacion,
  updateEstadoCotizacion,
  reactivarCotizacion,
} from "./mutations";

// Costos (subdominio)
export {
  fetchCotizacionCostos,
  fetchCotizacionCostosSnapshot,
  upsertCotizacionCostos,
  fetchCotizacionCostosForEmbarque,
} from "./costos";
export type { CotizacionCostosSnapshot, UpsertCostosResult } from "./costos";
;

// Conversiones (prospecto→cliente / cotización→embarques / portal)
export {
  convertirProspectoACliente,
  
  crearEmbarqueBorradorDesdeCotizacion,
  portalResponderCotizacion,
} from "./conversiones";
export type { ProspectoAClienteInput } from "./conversiones";


// Wizard (orquestadores de pasos)
export { savePaso1, savePaso2, savePaso3, savePasoFinal } from "./wizard";

// Informativa (tarifarios)
export {  parseTarifasInformativas } from "./informativa";

// Lógica pura del dominio (re-exportada por compatibilidad; preferir importar desde lib/domain/cotizacion)
export { buildConceptosFromCostos } from "@/features/cotizacion/domain/cotizacion";
;
