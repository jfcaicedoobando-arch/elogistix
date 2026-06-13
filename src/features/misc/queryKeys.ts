export const bitacora = {
  all: ['bitacora'] as const,
  list: (filters: Record<string, unknown>) => ['bitacora', filters] as const,
  reciente: (limite: number) => ['bitacora', 'reciente', limite] as const,
} as const;

export const trackingLinks = {
  all: ['tracking_links'] as const,
  byEmbarque: (embarqueId?: string) => ['tracking_links', embarqueId] as const,
} as const;


export const clienteFinancials = {
  byCliente: (clienteId?: string) => ['cliente-financials', clienteId] as const,
} as const;

export const pdfPreviewCotizacion = (id: string) => ['pdf-preview-cotizacion', id] as const;
export const trackingPublico = (token: string) => ['tracking-public', token] as const;
