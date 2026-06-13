/**
 * Barrel público parcial del dominio CRM.
 * Por ahora solo expone `domain/` (lógica pura). El resto del dominio
 * (components/hooks/services/pages/routes) vive aún en layer-first y
 * será migrado iterativamente — ver `.lovable/plan.md` Paso 9.
 */
export * as crmDomain from "./domain";
