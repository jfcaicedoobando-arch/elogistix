/**
 * Query Key Factory centralizado para React Query.
 * Importar desde aquí en lugar de usar strings hardcodeados.
 */
export const queryKeys = {
  embarques: {
    all: ['embarques'] as const,
    list: (filters: Record<string, unknown>) => ['embarques', 'list', filters] as const,
    detail: (id: string) => ['embarques', id] as const,
    conceptosVenta: (id: string) => ['conceptos_venta', id] as const,
    conceptosCosto: (id: string) => ['conceptos_costo', id] as const,
    documentos: (id: string) => ['documentos_embarque', id] as const,
    notas: (id: string) => ['notas_embarque', id] as const,
    facturas: (id: string) => ['facturas', 'embarque', id] as const,
    eventos: (id: string) => ['eventos_embarque', id] as const,
    relacionados: (id: string, blMaster: string) => ['embarques', 'relacionados', id, blMaster] as const,
  },
  cotizaciones: {
    all: ['cotizaciones'] as const,
    detail: (id: string) => ['cotizaciones', id] as const,
    costos: (id: string) => ['cotizacion_costos', id] as const,
    embarquesVinculados: (id: string) => ['embarques', 'cotizacion', id] as const,
  },
  clientes: {
    all: ['clientes'] as const,
    list: (filters: Record<string, unknown>) => ['clientes', 'list', filters] as const,
    detail: (id: string) => ['clientes', id] as const,
    select: ['clientes', 'select'] as const,
    contactos: (id: string) => ['contactos_cliente', id] as const,
    clientUsers: (id: string) => ['client_users', id] as const,
    embarques: (id: string) => ['clientes', 'embarques', id] as const,
    cotizaciones: (id: string) => ['clientes', 'cotizaciones', id] as const,
  },
  facturas: {
    all: ['facturas'] as const,
    gastosPendientes: ['gastos_pendientes'] as const,
  },
  proveedores: {
    all: ['proveedores'] as const,
    list: (filters: Record<string, unknown>) => ['proveedores', 'list', filters] as const,
    detail: (id: string) => ['proveedores', id] as const,
    select: ['proveedores', 'select'] as const,
    operaciones: (id: string) => ['proveedores', 'operaciones', id] as const,
  },
  configuracion: {
    all: ['configuracion'] as const,
  },
  puertos: {
    all: ['puertos'] as const,
    activos: ['puertos', 'activos'] as const,
    todos: ['puertos', 'todos'] as const,
  },
  exchangeRates: {
    all: ['exchange-rates'] as const,
  },
  bitacora: {
    all: ['bitacora'] as const,
    list: (filters: Record<string, unknown>) => ['bitacora', filters] as const,
    reciente: (limite: number) => ['bitacora', 'reciente', limite] as const,
  },
  dashboard: {
    stats: ['dashboard-stats'] as const,
    ventasUSD: ['dashboard-ventas-usd'] as const,
    costosUSD: ['dashboard-costos-usd'] as const,
    profitAggregated: ['dashboard-profit-aggregated'] as const,
    facturas: ['dashboard-facturas'] as const,
  },
  operadores: {
    distintos: ['operadores-distintos'] as const,
  },
  reportes: {
    conceptos: ['reportes', 'conceptos'] as const,
    cotizaciones: ['reportes', 'cotizaciones'] as const,
    rentabilidadClientes: (filtros: { fechaDesde?: string; fechaHasta?: string; modo?: string }) => ['reportes', 'rentabilidad', filtros] as const,
  },
  configuracionGlobal: {
    all: ['configuracion_global'] as const,
    categoria: (cat: string) => ['configuracion_global', cat] as const,
  },
  planes: {
    all: ['planes'] as const,
  },
  configuracionOrg: {
    byOrg: (orgId: string) => ['configuracion', 'org', orgId] as const,
  },
  navieras: {
    all: ['navieras'] as const,
    activas: ['navieras', 'activas'] as const,
    todas: ['navieras', 'todas'] as const,
  },
  tiposContenedor: {
    all: ['tipos_contenedor'] as const,
    activos: ['tipos_contenedor', 'activos'] as const,
    todos: ['tipos_contenedor', 'todos'] as const,
  },
  portal: {
    embarques: (clienteIds: string[]) => ['portal', 'embarques', clienteIds] as const,
    embarque: (id: string) => ['portal', 'embarque', id] as const,
    eventos: (id: string) => ['portal', 'eventos', id] as const,
    documentos: (id: string) => ['portal', 'documentos', id] as const,
    cotizaciones: (clienteIds: string[]) => ['portal', 'cotizaciones', clienteIds] as const,
    cotizacion: (id: string) => ['portal', 'cotizacion', id] as const,
    facturas: (clienteIds: string[]) => ['portal', 'facturas', clienteIds] as const,
    clientUsers: ['portal', 'client_users'] as const,
    clienteName: ['portal', 'cliente_nombre'] as const,
    orgName: ['portal', 'org_name'] as const,
  },
  sidebar: {
    alertCounts: ['sidebar-alert-counts'] as const,
  },
  admin: {
    organizations: ['admin-organizations'] as const,
    allUsers: ['admin-all-users'] as const,
    org: (id: string) => ['admin-org', id] as const,
    orgMembers: (id: string) => ['admin-org-members', id] as const,
    orgCountMembers: (id: string) => ['admin-org-count-members', id] as const,
    orgCountEmbarques: (id: string) => ['admin-org-count-embarques', id] as const,
    orgCountClientes: (id: string) => ['admin-org-count-clientes', id] as const,
    orgCountCotizaciones: (id: string) => ['admin-org-count-cotizaciones', id] as const,
    organizationsList: ['admin', 'organizations-list'] as const,
  },
} as const;
