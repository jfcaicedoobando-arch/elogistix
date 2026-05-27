/**
 * Servicio CRM — Leads. Barrel: re-exporta queries, mutations, bulk y conversión.
 * Refactor 11.60.0 (Bloque B1): partido por sub-acción para cumplir Power of 10 (≤200 líneas).
 * API pública intacta — los consumidores siguen importando desde `@/services/crm/leads`.
 */
export * from "./queries";
export * from "./mutations";
export * from "./bulk";
export * from "./convertir";
