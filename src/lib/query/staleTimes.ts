/**
 * Tiers estandarizados de `staleTime` para toda la app.
 *
 * El default global del `queryClient` es 60_000 (MEDIUM). Los factories de
 * `queryOptions()` deben elegir explícitamente su tier para hacer la intención
 * legible y evitar valores mágicos regados en hooks.
 *
 * - SHORT (30 s): detalle editable, conceptos, contadores.
 * - MEDIUM (60 s): listas paginadas, dashboards.
 * - LONG (5 min): folios, snapshots de cliente, catálogos ligeros.
 * - VERY_LONG (30 min): catálogos casi estáticos que ya tienen persister.
 */
export const staleTimes = {
  SHORT: 30_000,
  MEDIUM: 60_000,
  LONG: 5 * 60_000,
  VERY_LONG: 30 * 60_000,
} as const;


