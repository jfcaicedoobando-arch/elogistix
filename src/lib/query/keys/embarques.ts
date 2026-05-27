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
  conceptosVenta: (id: string) => ['conceptos_venta', id] as const,
  conceptosCosto: (id: string) => ['conceptos_costo', id] as const,
  documentos: (id: string) => ['documentos_embarque', id] as const,
  notas: (id: string) => ['notas_embarque', id] as const,
  facturas: (id: string) => ['facturas', 'embarque', id] as const,
  eventos: (id: string) => ['eventos_embarque', id] as const,
  relacionados: (id: string, blMaster: string) => ['embarques', 'relacionados', id, blMaster] as const,
} as const;
