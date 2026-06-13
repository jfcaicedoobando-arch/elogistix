export const facturas = {
  all: ['facturas'] as const,
  byOrg: (organizationId?: string | null) => ['facturas', organizationId] as const,
  detail: (id?: string | null) => ['facturas', 'detail', id] as const,
  gastosPendientes: ['gastos_pendientes'] as const,
  pagos: (facturaId: string) => ['pagos_factura', facturaId] as const,
  cobranza: (filtros?: unknown) => ['facturas', 'cobranza', filtros ?? null] as const,
  series: ['factura_series'] as const,
  notasCredito: (facturaId: string) => ['factura_notas_credito', facturaId] as const,
} as const;

