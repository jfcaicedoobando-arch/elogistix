export const cxp = {
  all: ["cxp"] as const,
  facturas: (filtros?: unknown) => ["cxp", "facturas", filtros ?? null] as const,
  factura: (id?: string | null) => ["cxp", "factura", id] as const,
  pagos: (facturaId: string) => ["cxp", "pagos", facturaId] as const,
  notasCredito: (facturaId: string) => ["cxp", "notas-credito", facturaId] as const,
} as const;
