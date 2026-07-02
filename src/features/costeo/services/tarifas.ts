/**
 * Fachada del servicio de tarifas marítimas. Divide en `queries.ts` y `mutations.ts`
 * para respetar Power of 10 (≤200 líneas). Los consumidores siguen importando desde
 * `@/features/costeo/services/tarifas`.
 */
export * from "./tarifas/queries";
export * from "./tarifas/mutations";
