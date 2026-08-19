/**
 * Superficie pública de los servicios de operaciones.
 *
 * Ola 20 · paso 4: sólo re-exporta.
 */
export type {
  NivelRiesgo,
  CargaRiesgo,
  DesgloseEstados,
  ClienteCarga,
  EstadoUiKey,
  EmbarqueResumen,
  EmbarquesPorEstadoBucket,
  EmbarquesPorEstado,
  ServerOperador,
  ServerStats,
} from "./operacionesTypes";
export { fetchOperacionesStats } from "./operacionesStats";
