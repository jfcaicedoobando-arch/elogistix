/**
 * Shim de compatibilidad — la implementación vive en
 * `src/services/configuracion/emisor.ts` para mantener la separación
 * de responsabilidades (PDF no debe hablar directo con Supabase).
 *
 * Se mantiene el nombre `cargarEmisorEmpresa` como alias del nuevo
 * `fetchEmisorEmpresa` para no romper los 5 call sites de `src/generators/`.
 */
export { fetchEmisorEmpresa as cargarEmisorEmpresa } from "@/features/configuracion/services";
