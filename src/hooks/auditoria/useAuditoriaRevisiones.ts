/**
 * Hooks de revisiones de auditoría: marca/desmarca/asigna hallazgos.
 *
 * 11.14.0: archivo dividido en `revisiones/{hash,query,marcar,desmarcar,asignar}`
 * para cumplir Power of 10 (≤200 líneas). Barrel preserva la API pública.
 */
export { hallazgoHash, revisionKey, AUDITORIA_REVISIONES_KEY } from "./revisiones/hash";
export { useAuditoriaRevisiones } from "./revisiones/query";
export { useMarcarRevisado } from "./revisiones/marcar";
export { useDesmarcarRevisado } from "./revisiones/desmarcar";
export { useAsignarResponsable } from "./revisiones/asignar";
