export const bitacora = {
  all: ['bitacora'] as const,
  list: (filters: Record<string, unknown>) => ['bitacora', filters] as const,
  reciente: (limite: number) => ['bitacora', 'reciente', limite] as const,
} as const;

export const dashboard = {
  stats: ['dashboard-stats'] as const,
  // El servidor resuelve la organización con `org_scope()`; la incluimos en la
  // llave para que el caché nunca mezcle tenants al cambiar de organización.
  statsSummary: (organizationId?: string | null) =>
    ['dashboard-stats', 'summary', organizationId ?? null] as const,
  statsDetails: (organizationId?: string | null) =>
    ['dashboard-stats', 'details', organizationId ?? null] as const,
  ventasUSD: ['dashboard-ventas-usd'] as const,
  costosUSD: ['dashboard-costos-usd'] as const,
  profitAggregated: ['dashboard-profit-aggregated'] as const,
  facturas: ['dashboard-facturas'] as const,
} as const;

export const operadores = {
  distintos: ['operadores-distintos'] as const,
} as const;

export const operaciones = {
  stats: (organizationId?: string | null) =>
    ['operaciones-stats', organizationId ?? null] as const,
} as const;


export const reportes = {
  conceptos: ['reportes', 'conceptos'] as const,
  cotizaciones: ['reportes', 'cotizaciones'] as const,
  rentabilidadClientes: (filtros: { fechaDesde?: string; fechaHasta?: string; modo?: string }) =>
    ['reportes', 'rentabilidad', filtros] as const,
} as const;

export const sidebar = {
  alertCounts: ['sidebar-alert-counts'] as const,
  adminPendientes: ['sidebar', 'embarques-admin-pendientes'] as const,
} as const;

export const direccion = {
  /** Defecto 6 (v13.823.43) — prefijo para invalidar todo el tablero de Dirección. */
  all: ['dashboard', 'direccion'] as const,
  kpis: (organizationId?: string | null, fallbackUsd?: number, fallbackEur?: number) =>
    ['dashboard', 'direccion', organizationId, fallbackUsd ?? null, fallbackEur ?? null] as const,
  /** FIX C3c: totales por moneda agregados en el servidor. */
  totales: (organizationId?: string | null, desdeIso?: string) =>
    ['dashboard', 'direccion', 'totales', organizationId, desdeIso ?? null] as const,
} as const;


export const dashboardOperador = {
  docsFaltantes: (email?: string | null) =>
    ['dashboard-operador', 'docs-faltantes', email] as const,
  sinTracking: (email?: string | null) =>
    ['dashboard-operador', 'sin-tracking', email] as const,
} as const;

export const embarquesPendientesAdmin = {
  all: ['dashboard', 'embarques-pendientes-admin'] as const,
} as const;
