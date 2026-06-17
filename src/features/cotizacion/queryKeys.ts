export const cotizaciones = {
  all: ['cotizaciones'] as const,
  byOrg: (organizationId?: string | null) => ['cotizaciones', organizationId] as const,
  aceptadas: (organizationId?: string | null) => ['cotizaciones', 'aceptadas', organizationId] as const,
  detail: (id: string) => ['cotizaciones', id] as const,
  costos: (id: string) => ['cotizacion_costos', id] as const,
  embarquesVinculados: (id: string) => ['embarques', 'cotizacion', id] as const,
} as const;

export const pdfPreviewCotizacion = (id: string) => ['pdf-preview-cotizacion', id] as const;
