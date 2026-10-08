/**
 * Shim de compatibilidad — la implementación vive en
 * `src/features/configuracion/services/emisorPdf.ts` para mantener la separación
 * de responsabilidades (PDF no debe hablar directo con Supabase).
 *
 * Se mantiene el nombre `cargarEmisorEmpresa` como alias del nuevo
 * `fetchEmisorPdf` para los reportes y se exige la organización persistida
 * mediante `cargarEmisorDocumento` en cotizaciones y proformas.
 */
export {
  fetchEmisorPdf as cargarEmisorEmpresa,
  fetchEmisorDocumento as cargarEmisorDocumento,
  fetchEmisorEntidad as cargarEmisorEntidad,
  fetchEmisorReporte as cargarEmisorReporte,
} from "@/features/configuracion/services/emisorPdf";
