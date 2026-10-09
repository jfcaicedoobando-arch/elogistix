export const crm = {
  resumenPricing: (organizationId: string | null, userId?: string) => ["crm", "pricing", "resumen", organizationId, userId] as const,
  origenEmpresa: (id: string) => ["crm", "origen-empresa", id] as const,
  adjuntoUrl: (path: string) => ["crm", "pricing", "adjunto-url", path] as const,
  adjuntos: (id: string) => ["crm", "pricing", "adjuntos", id] as const,
  objetos: {
    all: ["crm", "objetos"] as const,
    empresasSimilares: (termino: string) => ["crm", "objetos", "empresas-similares", termino] as const,
    list: (tipo: string, busqueda: string, pagina: number, ...filtros: string[]) => ["crm", "objetos", tipo, busqueda, pagina, ...filtros] as const,
    detail: (tipo: string, id?: string) => ["crm", "objetos", tipo, id] as const,
    relacion: (relacion: string, id: string) => ["crm", "objetos", "rel", relacion, id] as const,
  },
  propiedades: {
    all: ["crm", "propiedades"] as const,
    objeto: (objeto: string) => ["crm", "propiedades", objeto] as const,
    valores: (id: string) => ["crm", "propiedades", "valores", id] as const,
  },
  scoring: {
    all: ["crm", "scoring"] as const,
    detalle: (objeto: string, id: string) => ["crm", "scoring", "detalle", objeto, id] as const,
    lote: (objeto: string, ids: string[]) => ["crm", "scoring", "lote", objeto, ids] as const,
    reglas: (objeto: string) => ["crm", "scoring", "reglas", objeto] as const,
    cortes: ["crm", "scoring", "cortes"] as const,
  },
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
  cotizacionesSinRespuesta: (diasUmbral: number, limit: number, uid?: string) =>
    ['crm', 'cotizaciones-sin-respuesta', diasUmbral, limit, uid] as const,
  prospectoSearch: (term: string) => ['crm', 'prospecto-search', term] as const,
  prospectoOportunidad: (id: string) => ['crm', 'prospecto-oportunidad', id] as const,
  search: (term: string) => ['crm', 'search', term] as const,
  /** Etiqueta del prospecto (lead) de una oportunidad. */
  leadNombre: (leadId: string | null) => ['crm', 'lead-nombre', leadId] as const,
  /** Moneda de la oportunidad ligada a una cotización. */
  oportunidadMoneda: (oportunidadId: string | null) =>
    ['crm', 'oportunidad-moneda', oportunidadId] as const,
  nbaSignals: (uid?: string) => ['crm', 'nba-signals', uid] as const,
  /** Prefijo para invalidar las señales NBA de cualquier usuario. */
  nbaSignalsAll: ['crm', 'nba-signals'] as const,
  actividades: {
    all: ['crm', 'actividades'] as const,
    list: (filters: Record<string, unknown>) => ['crm', 'actividades', filters] as const,
    vencidasCount: (uid?: string) => ['crm', 'actividades', 'vencidas-count', uid] as const,
    vencidasList: (uid?: string, limit?: number) =>
      ['crm', 'actividades', 'vencidas-list', uid, limit] as const,
    /** Sin `ambito` es el prefijo; con ámbito, la key completa del listado. */
    paged: (uid?: string, ambito?: 'vencidas' | 'todas') =>
      ['crm', 'actividades', 'paged', uid, ...(ambito ? [ambito] : [])] as const,
  },
  leads: {
    all: ['crm', 'leads'] as const,
    list: (filters: Record<string, unknown>) => ['crm', 'leads', filters] as const,
    detail: (id: string) => ['crm', 'leads', 'detail', id] as const,
    paged: ['crm', 'leads', 'paged'] as const,
    /** Duplicados de un lote (importación CSV). */
    duplicados: (
      claves: ReadonlyArray<{ empresa: string; email: string; telefono: string }>,
      organizationId?: string | null,
    ) => organizationId === undefined
      ? ['crm', 'leads', 'duplicados', claves] as const
      : ['crm', 'leads', 'duplicados', claves, organizationId] as const,
    /** Duplicado de un solo lead (alta manual). */
    duplicado: (
      empresa?: string | null,
      email?: string | null,
      telefono?: string | null,
      organizationId?: string | null,
    ) =>
      organizationId === undefined
        ? ['crm', 'leads', 'duplicado', empresa, email, telefono] as const
        : ['crm', 'leads', 'duplicado', empresa, email, telefono, organizationId] as const,
  },
  prospectos: {
    all: ['crm', 'prospectos'] as const,
    paged: ['crm', 'prospectos', 'paged'] as const,
    select: (term: string) => ['crm', 'prospectos', 'select', term] as const,
  },
  oportunidades: {
    all: ['crm', 'oportunidades'] as const,
    list: (filters: Record<string, unknown>) => ['crm', 'oportunidades', filters] as const,
    detail: (id: string) => ['crm', 'oportunidades', 'detail', id] as const,
    byLead: (leadId: string) => ['crm', 'oportunidades', 'by-lead', leadId] as const,
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
    analitica: ['crm', 'etapas', 'analitica'] as const,
    all: ['crm', 'etapas'] as const,
    todas: ['crm', 'etapas', 'all'] as const,
  },
  criterios: {
    all: ['crm', 'criterios'] as const,
    byEtapa: (etapaId?: string) => ['crm', 'criterios', 'etapa', etapaId ?? 'todas'] as const,
    cumplimiento: (oportunidadId: string) =>
      ['crm', 'criterios', 'cumplimiento', oportunidadId] as const,
    avance: (oportunidadIds: string[]) => ['crm', 'criterios', 'avance', oportunidadIds] as const,
  },
  higiene: {

    all: ['crm', 'higiene'] as const,
    resumen: ['crm', 'higiene', 'resumen'] as const,
    oportunidades: ['crm', 'higiene', 'oportunidades'] as const,
  },
  embudoConversion: (desde: string, hasta: string) =>
    ['crm', 'embudo-conversion', desde, hasta] as const,
  avanceActividad: (desde: string, hasta: string) =>
    ['crm', 'avance-actividad', desde, hasta] as const,
  presupuesto: {
    all: ['crm', 'presupuesto'] as const,
    anio: (anio: number) => ['crm', 'presupuesto', anio] as const,
  },
  metas: {
    all: ['crm', 'metas-actividad'] as const,
  },
  motivos: {
    all: ['crm', 'motivos'] as const,
    list: (soloActivos: boolean) => ['crm', 'motivos', soloActivos] as const,
  },
} as const;
