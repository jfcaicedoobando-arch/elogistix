export const clientes = {
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
  exposicionCredito: (id: string) => ['clientes', 'exposicion_credito', id] as const,
  paraPdf: (id: string) => ['clientes', 'para_pdf', id] as const,
} as const;

export const clienteFinancials = {
  byCliente: (clienteId?: string) => ['cliente-financials', clienteId] as const,
} as const;
