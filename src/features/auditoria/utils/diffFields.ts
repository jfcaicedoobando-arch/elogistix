/**
 * Fachada delgada: la implementación vive en `@/lib/domain/auditDiff` y
 * `@/lib/domain/auditDiffConceptos` (paso 9 de la auditoría). Se conserva para
 * los consumidores internos de Auditoría y sus pruebas; no duplica lógica.
 */
export type { FieldDiff } from "@/lib/domain/auditDiff";
export { diffFields, SENSITIVE_FIELDS } from "@/lib/domain/auditDiff";
export type { ConceptoLike, ConceptosDiff } from "@/lib/domain/auditDiffConceptos";
export { diffConceptos } from "@/lib/domain/auditDiffConceptos";
