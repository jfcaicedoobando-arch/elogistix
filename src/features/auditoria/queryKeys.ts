export const auditoria = {
  all: ['auditoria'] as const,
  revisiones: ['auditoria', 'revisiones'] as const,
  embarques: ['auditoria', 'embarques'] as const,
  snapshots: (dias?: number) => ['auditoria', 'snapshots', dias] as const,
  snapshotsAll: ['auditoria', 'snapshots'] as const,
  asignables: (organizationId?: string | null) =>
    ['auditoria', 'asignables', organizationId] as const,
} as const;
