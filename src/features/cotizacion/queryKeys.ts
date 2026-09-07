export const cotizaciones = {
  all: ['cotizaciones'] as const,
  byOrg: (organizationId?: string | null) => ['cotizaciones', organizationId] as const,
  aceptadas: (organizationId?: string | null) => ['cotizaciones', 'aceptadas', organizationId] as const,
  detail: (id: string) => ['cotizaciones', id] as const,
  costos: (id: string) => ['cotizacion_costos', id] as const,
  costosSnapshot: (id: string) => ['cotizacion_costos', id, 'snapshot'] as const,
  embarquesVinculados: (id: string) => ['embarques', 'cotizacion', id] as const,
  folio: (id: string) => ['cotizaciones', 'folio', id] as const,
  envios: (cotizacionId?: string) => ['cotizacion-envios', cotizacionId] as const,
  tarifaVinculada: (tarifaId: string | null) => ['cotizacion', 'tarifa-vinculada', tarifaId] as const,
  pendientesReaprobacion: {
    all: ['cotizaciones', 'pendientes-reaprobacion', 'all'] as const,
    mias: (email: string | null) => ['cotizaciones', 'pendientes-reaprobacion', 'mias', email] as const,
  },
  // P3 (v13.297.0): Versiones (snapshots inmutables) por cotización.
  versiones: (cotizacionId: string) => ['cotizacion_versiones', cotizacionId] as const,
  // YG-03: listado paginado server-side + agregados (KPIs, conteos por segmento).
  paged: (organizationId?: string | null) => ['cotizaciones', 'paged', organizationId] as const,
  agregados: (organizationId?: string | null, segmento?: string) =>
    ['cotizaciones', 'agregados', organizationId, segmento] as const,
} as const;

export const productosCatalogo = (organizationId?: string | null) =>
  ['productos_catalogo', organizationId] as const;

export const pdfPreviewCotizacion = (id: string) => ['pdf-preview-cotizacion', id] as const;

// P2 (v13.295.0): Plantillas de cotización.
export const cotizacionPlantillas = {
  all: ['cotizacion_plantillas'] as const,
  byOrg: (organizationId?: string | null) => ['cotizacion_plantillas', organizationId] as const,
  detail: (id: string) => ['cotizacion_plantillas', 'detail', id] as const,
} as const;

