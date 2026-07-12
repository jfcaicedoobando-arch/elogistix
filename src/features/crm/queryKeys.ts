export const crm = {
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
  cotizacionesSinRespuesta: (diasUmbral: number, limit: number) =>
    ['crm', 'cotizaciones-sin-respuesta', diasUmbral, limit] as const,
  prospectoSearch: (term: string) => ['crm', 'prospecto-search', term] as const,
  search: (term: string) => ['crm', 'search', term] as const,
  nbaSignals: (uid?: string) => ['crm', 'nba-signals', uid] as const,
  actividades: {
    all: ['crm', 'actividades'] as const,
    list: (filters: Record<string, unknown>) => ['crm', 'actividades', filters] as const,
    vencidasCount: (uid?: string) => ['crm', 'actividades', 'vencidas-count', uid] as const,
    vencidasList: (uid?: string, limit?: number) =>
      ['crm', 'actividades', 'vencidas-list', uid, limit] as const,
    paged: (uid?: string) => ['crm', 'actividades', 'paged', uid] as const,
  },
  leads: {
    all: ['crm', 'leads'] as const,
    list: (filters: Record<string, unknown>) => ['crm', 'leads', filters] as const,
    detail: (id: string) => ['crm', 'leads', 'detail', id] as const,
    paged: ['crm', 'leads', 'paged'] as const,
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
} as const;
