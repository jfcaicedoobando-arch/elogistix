export const embarques = {
  all: ['embarques'] as const,
  list: (filters: Record<string, unknown>) => ['embarques', 'list', filters] as const,
  detail: (id: string) => ['embarques', id] as const,
  full: (id?: string) => ['embarques', 'full', id] as const,
  fullForEstadoFilter: (filters: Record<string, unknown>) =>
    ['embarques', 'full-for-estado-filter', filters] as const,
  extrasBranchB: (visibleIds: string[]) => ['embarques', 'extras-branch-b', visibleIds] as const,
  expedientesCliente: (clienteId?: string | null, organizationId?: string | null) =>
    ['embarques', 'expedientes-cliente', clienteId, organizationId] as const,
  conceptosVenta: (id?: string) => ['conceptos_venta', id] as const,
  conceptosCosto: (id?: string) => ['conceptos_costo', id] as const,
  documentos: (id: string) => ['documentos_embarque', id] as const,
  notas: (id: string) => ['notas_embarque', id] as const,
  facturas: (id: string) => ['facturas', 'embarque', id] as const,
  eventos: (id: string) => ['eventos_embarque', id] as const,
  relacionados: (id: string, blMaster: string) => ['embarques', 'relacionados', id, blMaster] as const,
  // Detalle singular (distinto de `detail`, usado por hooks de cierre/pnl/seguros/proformas).
  single: (id?: string) => ['embarque', id] as const,
  bitacora: (embarqueId?: string, expediente?: string) =>
    ['embarques', 'bitacora', embarqueId, expediente] as const,
  adminPendientes: (embarqueId?: string) => ['embarque', embarqueId, 'admin-pendientes'] as const,
  cierreValidacion: (embarqueId?: string) => ['embarque', embarqueId, 'cierre-validacion'] as const,
  cierreLog: (embarqueId?: string) => ['embarque', embarqueId, 'cierre-log'] as const,
  contenedores: (embarqueId?: string) => ['embarque-contenedores', embarqueId] as const,
  contenedoresInfoMap: (ids: string[]) => ['embarque-contenedores-info-map', ids] as const,
  docsFaltantes: (embarqueId?: string, estadoDestino?: string | null) =>
    ['embarque_docs_faltantes', embarqueId, estadoDestino] as const,
  dependenciasFinancieras: (embarqueId?: string) =>
    ['embarques', 'dependencias-financieras', embarqueId] as const,
  tarifaInfo: (embarqueId?: string) => ['embarques', 'tarifa-info', embarqueId] as const,
  alertasResumen: () => ['embarques', 'alertas-ids'] as const,
  garantias: (embarqueId?: string) => ['garantias-embarque', embarqueId] as const,
  pnlFinanciero: (embarqueId?: string) => ['embarque', embarqueId, 'pnl-financiero'] as const,
  reconciliacion3Columnas: (embarqueId?: string, umbrales?: unknown) =>
    ['embarques', 'reconciliacion3c', embarqueId, umbrales] as const,
  reconciliacion: (embarqueId?: string) => ['embarques', 'reconciliacion', embarqueId] as const,
  seguros: (embarqueId?: string) => ['embarque', embarqueId, 'seguros'] as const,
} as const;

export const trackingLinks = {
  all: ['tracking_links'] as const,
  byEmbarque: (embarqueId?: string) => ['tracking_links', embarqueId] as const,
} as const;

export const trackingPublico = (token: string) => ['tracking-public', token] as const;
