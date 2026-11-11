/**
 * Hooks de Leads (CRM Fase 2).
 *
 * Hooks divididos en `leads/{constants,queries,mutations,bulk}`
 * para cumplir Power of 10 (≤200 líneas). Este barrel preserva la API pública.
 */
export * from "./leads/constants";
export * from "./leads/queries";
export * from "./leads/mutations";
export * from "./leads/bulk";
