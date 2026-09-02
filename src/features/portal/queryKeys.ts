export const portal = {
  // A5 — Raíces de namespace para invalidación por prefijo: invalidar
  // `cotizacionesAll` alcanza todas las listas `cotizaciones(clienteIds)`.
  cotizacionesAll: ['portal', 'cotizaciones'] as const,
  facturasAll: ['portal', 'facturas'] as const,
  embarquesAll: ['portal', 'embarques'] as const,
  embarques: (clienteIds: string[]) => ['portal', 'embarques', clienteIds] as const,
  embarque: (id: string) => ['portal', 'embarque', id] as const,
  eventos: (id: string) => ['portal', 'eventos', id] as const,
  documentos: (id: string) => ['portal', 'documentos', id] as const,
  cotizaciones: (clienteIds: string[]) => ['portal', 'cotizaciones', clienteIds] as const,
  cotizacion: (id: string) => ['portal', 'cotizacion', id] as const,
  facturas: (clienteIds: string[]) => ['portal', 'facturas', clienteIds] as const,
  factura: (id: string) => ['portal', 'factura', id] as const,
  pagosFactura: (id: string) => ['portal', 'pagos_factura', id] as const,
  notasCreditoFactura: (id: string) => ['portal', 'notas_credito_factura', id] as const,
  resumenSaldoFactura: (id: string) => ['portal', 'resumen_saldo_factura', id] as const,
  clientUsers: ['portal', 'client_users'] as const,
  clienteName: ['portal', 'cliente_nombre'] as const,
  contactoName: ['portal', 'contacto_nombre'] as const,
  orgName: ['portal', 'org_name'] as const,
  perfil: ['portal', 'perfil'] as const,
} as const;
