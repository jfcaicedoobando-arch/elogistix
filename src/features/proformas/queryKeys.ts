export const proformas = {
  all: ['proformas'] as const,
  embarque: (embarqueId?: string) => ['proformas', 'embarque', embarqueId] as const,
  pendientes: (orgId?: string | null) => ['proformas', 'pendientes', orgId] as const,
  aprobadas: (orgId?: string | null) => ['proformas', 'all', orgId] as const,
  conceptosVenta: ['conceptos_venta'] as const,
  detalle: (id?: string) => ['proformas', 'detalle', id] as const,
  bitacora: (id?: string) => ['proformas', 'bitacora', id] as const,
  destinatariosSugeridos: (clienteId?: string | null) =>
    ['proformas', 'destinatarios-sugeridos', clienteId] as const,
  enviarEmail: (proformaId: string) => ['proformas', 'enviar-email', proformaId] as const,
  convertirDirecto: ['proformas', 'convertir-directo'] as const,
} as const;
