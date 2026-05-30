export const facturas = {
  all: ['facturas'] as const,
  byOrg: (organizationId?: string | null) => ['facturas', organizationId] as const,
  gastosPendientes: ['gastos_pendientes'] as const,
  pagos: (facturaId: string) => ['pagos_factura', facturaId] as const,
} as const;
