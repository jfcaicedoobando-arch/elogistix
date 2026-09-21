/**
 * Fachada delgada: la implementación vive en `@/lib/domain/auditDiffConceptos`
 * (paso 9 de la auditoría). Sin lógica duplicada.
 */
export type { ConceptoLike, ConceptosDiff } from "@/lib/domain/auditDiffConceptos";
export { diffConceptos } from "@/lib/domain/auditDiffConceptos";
