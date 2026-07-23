/**
 * Sprint 2 · ítem 6 — Re-export de compatibilidad.
 *
 * El módulo canónico vive ahora en `src/services/bitacora/registrar.ts` (capa
 * services). Este archivo queda temporalmente como shim para no romper los
 * ~10 callers históricos que aún importan desde `@/lib/domain/bitacora/...`.
 * Se migrarán en una PR de higiene subsecuente y este archivo se eliminará.
 */
export {
  MODULOS_BITACORA,
  registrarActividad,
  type ModuloBitacora,
  type RegistrarActividadInput,
} from "@/services/bitacora/registrar";
