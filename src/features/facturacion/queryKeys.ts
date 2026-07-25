// Query keys del módulo unificado Facturación (incluye lo que antes vivía en features/facturas).
export const facturacion = {
  hueco: (organizationId?: string | null) => ['facturacion', 'hueco', organizationId] as const,
  proyeccion: (organizationId: string | null | undefined, mesKey: string) =>
    ['facturacion', 'proyeccion', organizationId, mesKey] as const,
  clienteFiscal: (clienteId?: string | null) => ['cliente_fiscal', clienteId] as const,
  clienteDefaults: (clienteId?: string | null) => ['cliente_defaults_facturacion', clienteId] as const,
  clientesFiscalOpts: (organizationId?: string | null) => ['clientes_fiscal_opts', organizationId] as const,
  emisorEmpresa: ['emisor-empresa'] as const,
  bandejaPorTimbrar: (organizationId?: string | null) => ['facturacion', 'bandeja', 'por-timbrar', organizationId] as const,
  bandejaPorEnviar: (organizationId?: string | null) => ['facturacion', 'bandeja', 'por-enviar', organizationId] as const,
  bandejaRepPendientes: (organizationId?: string | null) => ['facturacion', 'bandeja', 'rep-pendientes', organizationId] as const,
  bandejaConteos: (organizationId?: string | null) => ['facturacion', 'bandeja', 'conteos', organizationId] as const,
  bandejaProformasListas: (organizationId?: string | null) => ['facturacion', 'bandeja', 'proformas-listas', organizationId] as const,
  bandejaProformasListasCount: (organizationId?: string | null) =>
    ['facturacion', 'bandeja', 'proformas-listas', 'count', organizationId] as const,
  dashboardEjecutivo: (organizationId?: string | null, fallback?: unknown) =>
    ['facturacion', 'dashboard-ejecutivo', organizationId, fallback] as const,
  referenciasEmbarque: (embarqueId?: string | null, expediente?: string, referenciaBl?: string) =>
    ['referencias_embarque_factura', embarqueId, expediente ?? '', referenciaBl ?? ''] as const,
  proformaDetalleAll: ['proforma-detalle'] as const,
  emitirFactura: ['fiscal', 'emitir-factura'] as const,
  cancelarFactura: ['fiscal', 'cancelar-factura'] as const,
  facturaManual: ['fiscal', 'factura-manual'] as const,
  eliminarBorrador: ['fiscal', 'eliminar-borrador'] as const,
  emitirNotaCredito: ['fiscal', 'emitir-nota-credito'] as const,
  cancelarNotaCredito: ['fiscal', 'cancelar-nota-credito'] as const,
  actualizarDatosTimbrado: ['fiscal', 'actualizar-datos-timbrado'] as const,
  guardarDefaultsCliente: ['fiscal', 'guardar-defaults-cliente'] as const,
  enviarCfdiEmail: ['fiscal', 'enviar-cfdi-email'] as const,
  emitirRep: ['fiscal', 'emitir-rep'] as const,
  cancelarRep: ['fiscal', 'cancelar-rep'] as const,
  acuseReintentar: (facturaId?: string | null) => ['factura', 'acuse-reintentar', facturaId] as const,
  repPendientes: ['rep_pendientes'] as const,
  sustitutaEstado: (nuevaId?: string | null) => ['factura-sustituta-estado', nuevaId] as const,
  sustitutasDe: (facturaId?: string | null) => ['facturas', 'sustitutas-de', facturaId] as const,
  contactosClienteEnvio: (clienteId?: string | null) => ['contactos-cliente-envio', clienteId] as const,
} as const;


export const facturas = {
  all: ['facturas'] as const,
  byOrg: (organizationId?: string | null) => ['facturas', organizationId] as const,
  detail: (id?: string | null) => ['facturas', 'detail', id] as const,
  gastosPendientes: ['gastos_pendientes'] as const,
  pagos: (facturaId: string) => ['pagos_factura', facturaId] as const,
  pagosAll: ['pagos_factura'] as const,
  cobranza: (filtros?: unknown) => ['facturas', 'cobranza', filtros ?? null] as const,
  series: ['factura_series'] as const,
  notasCredito: (facturaId: string) => ['factura_notas_credito', facturaId] as const,
  notasCreditoRecientes: (filtros?: unknown) => ['factura_notas_credito', 'recientes', filtros ?? null] as const,
  envios: (facturaId?: string | null) => ['factura-envios', facturaId] as const,
  historial: (facturaId?: string | null) => ['facturas', 'historial', facturaId] as const,
  legacyDetail: (facturaId?: string | null) => ['factura', facturaId] as const,
  listado: (filtros: {
    organizationId?: string | null;
    search?: string;
    estado?: string;
    page?: number;
    pageSize?: number;
  }) =>
    [
      'facturas', 'listado',
      filtros.organizationId ?? null,
      filtros.search ?? '',
      filtros.estado ?? 'todos',
      filtros.page ?? 0,
      filtros.pageSize ?? 100,
    ] as const,
} as const;

export const estadoCuenta = {
  list: (filters: {
    clienteIds: readonly string[];
    desde?: string | null;
    hasta?: string | null;
    moneda?: string | null;
    soloConSaldo?: boolean;
  }) =>
    [
      "estado-cuenta",
      [...filters.clienteIds].sort(),
      filters.desde ?? null,
      filters.hasta ?? null,
      filters.moneda ?? "todas",
      filters.soloConSaldo ?? false,
    ] as const,
} as const;
