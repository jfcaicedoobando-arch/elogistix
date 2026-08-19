/**
 * Superficie pública de los servicios de reportes.
 *
 * Ola 20 · paso 4: sólo re-exporta.
 */
export type {
  SidebarAlertCounts,
  RentabilidadFiltros,
  ResumenClienteRow,
  ReportesResumenKpis,
  ReportesResumen,
} from "./reportesTypes";
export {
  fetchSidebarAlertCounts,
  fetchReportesResumen,
  fetchOperadoresDistintos,
} from "./reportesGlobales";
