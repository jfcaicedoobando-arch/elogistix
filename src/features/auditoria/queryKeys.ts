const revisiones = ['auditoria', 'revisiones'] as const;
const pendientesCountAll = [...revisiones, 'pendientes-count'] as const;

export const auditoria = {
  all: ['auditoria'] as const,
  revisiones,
  pendientesCountAll,
  pendientesCount: (organizationId: string | null) =>
    [...pendientesCountAll, organizationId] as const,
  embarques: ['auditoria', 'embarques'] as const,
  snapshots: (dias?: number, organizationId?: string | null) =>
    ['auditoria', 'snapshots', dias, organizationId ?? 'global'] as const,
  snapshotsAll: ['auditoria', 'snapshots'] as const,
  asignables: (organizationId?: string | null) =>
    ['auditoria', 'asignables', organizationId] as const,
} as const;
