export const proveedores = {
  all: ['proveedores'] as const,
  list: (filters: Record<string, unknown>) => ['proveedores', 'list', filters] as const,
  detail: (id: string) => ['proveedores', id] as const,
  select: ['proveedores', 'select'] as const,
  selectByOrg: (organizationId?: string | null) => ['proveedores', 'select', organizationId] as const,
  operaciones: (id: string) => ['proveedores', 'operaciones', id] as const,
  lite: (organizationId?: string | null) => ['proveedores', 'lite', organizationId] as const,
  rfcCheck: (rfc: string, organizationId?: string | null) =>
    ['proveedores', 'rfc-check', organizationId, rfc] as const,
} as const;
