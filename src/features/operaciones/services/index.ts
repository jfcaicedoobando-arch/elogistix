/**
 * Superficie pública de los servicios de operaciones.
 *
 * Ola 20 · paso 4: sólo re-exporta.
 */
export type {
  EstadoUiKey,
  EmbarquesPorEstadoBucket,
  EmbarquesPorEstado,
} from "./operacionesTypes";
export { fetchOperacionesStats } from "./operacionesStats";
