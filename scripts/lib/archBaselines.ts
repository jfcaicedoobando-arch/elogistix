/**
 * Fuente de verdad ÚNICA de los baselines de arquitectura.
 *
 * Consumido por:
 *   - `src/lib/__tests__/architecture-baseline.test.ts` (autoridad estricta:
 *     falla por violaciones nuevas Y por entradas obsoletas),
 *   - `src/__tests__/audit-report.test.ts` (smoke del reporte consolidado).
 *
 * No duplicar estos sets en ningún test. Al limpiar un archivo, quitarlo de
 * aquí; el check de entradas obsoletas avisará si se olvida.
 */

/** Imports directos a supabase/client permitidos en hooks/ y contexts/. */
export const HOOKS_CONTEXTS_BASELINE: ReadonlySet<string> = new Set<string>([
  // 11.59.0 — VACÍO. Toda la deuda histórica migrada a services/.
]);

/** Imports directos a supabase/client permitidos en components/ y pages/. */
export const PAGES_COMPONENTS_BASELINE: ReadonlySet<string> = new Set<string>([
  // 12.76.3 — VACÍO: todos los flujos de auth migrados a `@/services/auth`.
]);

/** Archivos productivos > 200 líneas pendientes de split (Power of 10 #1). */
export const OVERSIZED_BASELINE: ReadonlySet<string> = new Set<string>([
  "src/components/ui/date-picker-mx-helpers.ts",
]);

/** Todos los baselines, para pruebas de contrato. */
export const ARCH_BASELINES = {
  HOOKS_CONTEXTS_BASELINE,
  PAGES_COMPONENTS_BASELINE,
  OVERSIZED_BASELINE,
} as const;
