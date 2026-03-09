/**
 * Query Key Factory centralizado para React Query.
 * Importar desde aquí en lugar de usar strings hardcodeados.
 */
export const queryKeys = {
  embarques: {
    all: ['embarques'] as const,
    detail: (id: string) => ['embarques', id] as const,
    conceptosVenta: (id: string) => ['conceptos_venta', id] as const,
    conceptosCosto: (id: string) => ['conceptos_costo', id] as const,
    documentos: (id: string) => ['documentos_embarque', id] as const,
    notas: (id: string) => ['notas_embarque', id] as const,
    facturas: (id: string) => ['facturas', 'embarque', id] as const,
  },
  cotizaciones: {
    all: ['cotizaciones'] as const,
    detail: (id: string) => ['cotizaciones', id] as const,
    costos: (id: string) => ['cotizacion_costos', id] as const,
  },
  clientes: {
    all: ['clientes'] as const,
    list: (filters: Record<string, unknown>) => ['clientes', 'list', filters] as const,
    detail: (id: string) => ['clientes', id] as const,
    select: ['clientes', 'select'] as const,
    contactos: (id: string) => ['contactos_cliente', id] as const,
  },
  facturas: {
    all: ['facturas'] as const,
    gastosPendientes: ['gastos_pendientes'] as const,
  },
  proveedores: {
    all: ['proveedores'] as const,
    list: (filters: Record<string, unknown>) => ['proveedores', 'list', filters] as const,
    detail: (id: string) => ['proveedores', id] as const,
    select: ['proveedores', 'select'] as const,
  },
  configuracion: {
    all: ['configuracion'] as const,
  },
  puertos: {
    all: ['puertos'] as const,
    activos: ['puertos', 'activos'] as const,
    todos: ['puertos', 'todos'] as const,
  },
  exchangeRates: {
    all: ['exchange-rates'] as const,
  },
  bitacora: {
    all: ['bitacora'] as const,
    list: (filters: Record<string, unknown>) => ['bitacora', filters] as const,
    reciente: (limite: number) => ['bitacora', 'reciente', limite] as const,
  },
  dashboard: {
    ventasUSD: ['dashboard-ventas-usd'] as const,
    costosUSD: ['dashboard-costos-usd'] as const,
  },
  reportes: {
    conceptos: ['reportes', 'conceptos'] as const,
    cotizaciones: ['reportes', 'cotizaciones'] as const,
  },
} as const;
