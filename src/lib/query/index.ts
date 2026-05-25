/**
 * Query Key Factory centralizado para React Query.
 * Importar desde aquí en lugar de usar strings hardcodeados.
 */
export const queryKeys = {
  embarques: {
    all: ['embarques'] as const,
    list: (filters: Record<string, unknown>) => ['embarques', 'list', filters] as const,
    detail: (id: string) => ['embarques', id] as const,
    full: (id?: string) => ['embarques', 'full', id] as const,
    fullForEstadoFilter: (filters: Record<string, unknown>) =>
      ['embarques', 'full-for-estado-filter', filters] as const,
    extrasBranchB: (visibleIds: string[]) => ['embarques', 'extras-branch-b', visibleIds] as const,
    expedientesCliente: (clienteId?: string | null, organizationId?: string | null) =>
      ['embarques', 'expedientes-cliente', clienteId, organizationId] as const,
    conceptosVenta: (id: string) => ['conceptos_venta', id] as const,
    conceptosCosto: (id: string) => ['conceptos_costo', id] as const,
    documentos: (id: string) => ['documentos_embarque', id] as const,
    notas: (id: string) => ['notas_embarque', id] as const,
    facturas: (id: string) => ['facturas', 'embarque', id] as const,
    eventos: (id: string) => ['eventos_embarque', id] as const,
    relacionados: (id: string, blMaster: string) => ['embarques', 'relacionados', id, blMaster] as const,
  },
  proformas: {
    all: ['proformas'] as const,
    embarque: (embarqueId?: string) => ['proformas', 'embarque', embarqueId] as const,
    pendientes: (orgId?: string | null) => ['proformas', 'pendientes', orgId] as const,
    aprobadas: (orgId?: string | null) => ['proformas', 'all', orgId] as const,
    conceptosVenta: ['conceptos_venta'] as const,
  },
  cotizaciones: {
    all: ['cotizaciones'] as const,
    byOrg: (organizationId?: string | null) => ['cotizaciones', organizationId] as const,
    aceptadas: (organizationId?: string | null) => ['cotizaciones', 'aceptadas', organizationId] as const,
    detail: (id: string) => ['cotizaciones', id] as const,
    costos: (id: string) => ['cotizacion_costos', id] as const,
    embarquesVinculados: (id: string) => ['embarques', 'cotizacion', id] as const,
  },
  clientes: {
    all: ['clientes'] as const,
    list: (filters: Record<string, unknown>) => ['clientes', 'list', filters] as const,
    detail: (id: string) => ['clientes', id] as const,
    select: ['clientes', 'select'] as const,
    selectByOrg: (organizationId?: string | null) => ['clientes', 'select', organizationId] as const,
    contactos: (id: string) => ['contactos_cliente', id] as const,
    clientUsers: (id: string) => ['client_users', id] as const,
    embarques: (id: string) => ['clientes', 'embarques', id] as const,
    cotizaciones: (id: string) => ['clientes', 'cotizaciones', id] as const,
    diasCredito: (id: string) => ['clientes', 'dias_credito', id] as const,
    paraPdf: (id: string) => ['clientes', 'para_pdf', id] as const,
  },
  facturas: {
    all: ['facturas'] as const,
    byOrg: (organizationId?: string | null) => ['facturas', organizationId] as const,
    gastosPendientes: ['gastos_pendientes'] as const,
  },
  proveedores: {
    all: ['proveedores'] as const,
    list: (filters: Record<string, unknown>) => ['proveedores', 'list', filters] as const,
    detail: (id: string) => ['proveedores', id] as const,
    select: ['proveedores', 'select'] as const,
    selectByOrg: (organizationId?: string | null) => ['proveedores', 'select', organizationId] as const,
    operaciones: (id: string) => ['proveedores', 'operaciones', id] as const,
  },
  configuracion: {
    all: ['configuracion'] as const,
  },
  trackingLinks: {
    all: ['tracking_links'] as const,
    byEmbarque: (embarqueId?: string) => ['tracking_links', embarqueId] as const,
  },
  jsonCargo: {
    byEmbarque: (embarqueId?: string) => ['tracking_externo', 'jsoncargo', embarqueId] as const,
  },
  clienteFinancials: {
    byCliente: (clienteId?: string) => ['cliente-financials', clienteId] as const,
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
    statsSummary: ['dashboard-stats', 'summary'] as const,
    statsDetails: ['dashboard-stats', 'details'] as const,
    ventasUSD: ['dashboard-ventas-usd'] as const,
    costosUSD: ['dashboard-costos-usd'] as const,
    profitAggregated: ['dashboard-profit-aggregated'] as const,
    facturas: ['dashboard-facturas'] as const,
  },
  operadores: {
    distintos: ['operadores-distintos'] as const,
  },
  operaciones: {
    stats: ['operaciones-stats'] as const,
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
  usuarios: {
    all: ['usuarios'] as const,
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
    orgActivity: ['admin', 'org-activity'] as const,
    recentOrgs: ['admin', 'recent-orgs'] as const,
  },
  crm: {
    all: ['crm'] as const,
    kpis: ['crm', 'kpis'] as const,
    dashboard: (uid?: string) => ['crm', 'dashboard', uid] as const,
    dashboardAll: ['crm', 'dashboard'] as const,
    reportes: ['crm', 'reportes'] as const,
    leaderboard: ['crm', 'leaderboard-vendedores'] as const,
    forecast: (desde: string, hasta: string) => ['crm', 'forecast', desde, hasta] as const,
    cliente360: (clienteId: string) => ['crm', 'cliente-360', clienteId] as const,
    proximasActividades: (entidadTipo: string, ids: string[]) =>
      ['crm', 'proximas-actividades', entidadTipo, ids] as const,
    actividades: {
      all: ['crm', 'actividades'] as const,
      list: (filters: Record<string, unknown>) => ['crm', 'actividades', filters] as const,
      vencidasCount: (uid?: string) => ['crm', 'actividades', 'vencidas-count', uid] as const,
      vencidasList: (uid?: string, limit?: number) =>
        ['crm', 'actividades', 'vencidas-list', uid, limit] as const,
    },
    leads: {
      all: ['crm', 'leads'] as const,
      list: (filters: Record<string, unknown>) => ['crm', 'leads', filters] as const,
      detail: (id: string) => ['crm', 'leads', 'detail', id] as const,
    },
    oportunidades: {
      all: ['crm', 'oportunidades'] as const,
      list: (filters: Record<string, unknown>) => ['crm', 'oportunidades', filters] as const,
      detail: (id: string) => ['crm', 'oportunidades', 'detail', id] as const,
    },
    opCotizaciones: {
      all: ['crm', 'op-cotizaciones'] as const,
      byOportunidad: (oportunidadId: string) => ['crm', 'op-cotizaciones', oportunidadId] as const,
    },
    comentarios: {
      all: ['crm', 'comentarios-op'] as const,
      byOportunidad: (oportunidadId: string, limit?: number) =>
        ['crm', 'comentarios-op', oportunidadId, limit] as const,
      byOportunidadAll: (oportunidadId: string) =>
        ['crm', 'comentarios-op', oportunidadId] as const,
    },
    lineage: {
      lead: (leadId: string) => ['crm', 'lineage', 'lead', leadId] as const,
      opCots: (oportunidadId: string) => ['crm', 'lineage', 'op', oportunidadId, 'cots'] as const,
      opEmbs: (oportunidadId: string, embarqueIdsKey: string) =>
        ['crm', 'lineage', 'op', oportunidadId, 'embs', embarqueIdsKey] as const,
      opLead: (oportunidadId: string, leadId: string) =>
        ['crm', 'lineage', 'op', oportunidadId, 'lead', leadId] as const,
    },
    plantillas: {
      all: ['crm', 'plantillas'] as const,
      list: (canal: string | undefined, soloActivas: boolean) =>
        ['crm', 'plantillas', canal ?? 'all', soloActivas] as const,
    },
    notificaciones: {
      all: ['crm', 'notificaciones'] as const,
      list: (uid?: string, limit?: number) => ['crm', 'notificaciones', uid, limit] as const,
      unreadCount: (uid?: string) => ['crm', 'notificaciones', 'unread-count', uid] as const,
    },
    etapas: {
      all: ['crm', 'etapas'] as const,
      todas: ['crm', 'etapas', 'all'] as const,
    },
    motivos: {
      all: ['crm', 'motivos'] as const,
      list: (soloActivos: boolean) => ['crm', 'motivos', soloActivos] as const,
    },
  },
  auditoria: {
    all: ['auditoria'] as const,
    revisiones: ['auditoria', 'revisiones'] as const,
    embarques: ['auditoria', 'embarques'] as const,
    snapshots: (dias?: number) => ['auditoria', 'snapshots', dias] as const,
    snapshotsAll: ['auditoria', 'snapshots'] as const,
    asignables: (organizationId?: string | null) => ['auditoria', 'asignables', organizationId] as const,
  },
  appLogs: {
    all: ['app_logs'] as const,
    list: (filters: Record<string, unknown>) => ['app_logs', filters] as const,
    fnList: ['app_logs', 'fn_list'] as const,
    healthSummary: (hours: number) => ['app_logs_health_summary', hours] as const,
    healthTimeline: (hours: number, buckets: number) =>
      ['app_logs_health_timeline', hours, buckets] as const,
  },
  facturacion: {
    hueco: (organizationId?: string | null) => ['facturacion', 'hueco', organizationId] as const,
    proyeccion: (organizationId: string | null | undefined, mesKey: string) =>
      ['facturacion', 'proyeccion', organizationId, mesKey] as const,
  },
  papelera: (tabla: string) => ['papelera', tabla] as const,
  idempotenciaLog: ['idempotencia-log'] as const,
  pdfPreviewCotizacion: (id: string) => ['pdf-preview-cotizacion', id] as const,
  trackingPublico: (token: string) => ['tracking-public', token] as const,
} as const;
