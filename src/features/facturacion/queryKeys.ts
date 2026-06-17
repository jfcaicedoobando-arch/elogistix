// Query keys del módulo unificado Facturación (incluye lo que antes vivía en features/facturas).
export const facturacion = {
  hueco: (organizationId?: string | null) => ['facturacion', 'hueco', organizationId] as const,
  proyeccion: (organizationId: string | null | undefined, mesKey: string) =>
    ['facturacion', 'proyeccion', organizationId, mesKey] as const,
} as const;

export const facturas = {
  all: ['facturas'] as const,
  byOrg: (organizationId?: string | null) => ['facturas', organizationId] as const,
  detail: (id?: string | null) => ['facturas', 'detail', id] as const,
  gastosPendientes: ['gastos_pendientes'] as const,
  pagos: (facturaId: string) => ['pagos_factura', facturaId] as const,
  cobranza: (filtros?: unknown) => ['facturas', 'cobranza', filtros ?? null] as const,
  series: ['factura_series'] as const,
  notasCredito: (facturaId: string) => ['factura_notas_credito', facturaId] as const,
  notasCreditoRecientes: (filtros?: unknown) => ['factura_notas_credito', 'recientes', filtros ?? null] as const,
} as const;
