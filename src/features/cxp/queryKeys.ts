export const cxp = {
  all: ["cxp"] as const,
  facturas: (filtros?: unknown) => ["cxp", "facturas", filtros ?? null] as const,
  facturasAbiertasProveedor: (proveedorId?: string | null) =>
    ["cxp", "facturas-abiertas-proveedor", proveedorId ?? null] as const,
  factura: (id?: string | null) => ["cxp", "factura", id] as const,
  facturaEditRow: (id?: string | null) => ["cxp", "factura-edit-row", id] as const,
  pagos: (facturaId: string) => ["cxp", "pagos", facturaId] as const,
  notasCredito: (facturaId: string) => ["cxp", "notas-credito", facturaId] as const,
  historial: (facturaId?: string | null) => ["cxp", "historial", facturaId ?? null] as const,
  aging: (fecha?: string | null) => ["cxp", "aging", fecha ?? "hoy"] as const,
  pendientesAprobacionCount: ["cxp", "pendientes-aprobacion-count"] as const,
  conceptosCostoAbiertos: (proveedorId?: string | null, organizationId?: string | null) =>
    ["cxp", "conceptos_costo_abiertos", proveedorId ?? null, organizationId ?? null] as const,
  sugerirEmbarques: (proveedorId?: string | null, organizationId?: string | null) =>
    ["cxp", "sugerir_embarques", proveedorId ?? null, organizationId ?? null] as const,
  buscarEmbarques: (term: string, organizationId?: string | null) =>
    ["cxp", "buscar_embarques", term, organizationId ?? null] as const,
  conciliacionCandidatos: (pagoId: string) =>
    ["cxp", "conciliacion-candidatos", pagoId] as const,
  conceptosCfdi: (facturaId?: string | null) =>
    ["cxp", "conceptos-cfdi", facturaId ?? null] as const,
} as const;

// Keys de dominios adyacentes que se invalidan desde CxP.
export const proveedorFacturas = {
  all: ["proveedor-facturas"] as const,
} as const;

export const proveedorNotasCredito = {
  all: ["proveedor-notas-credito"] as const,
} as const;

export const pagosProveedor = {
  all: ["pagos-proveedor"] as const,
} as const;

export const bbvaMovimientos = {
  all: ["bbva-movimientos"] as const,
} as const;

export const proveedorSalud = {
  byId: (proveedorId?: string | null) =>
    ["proveedor", "salud", proveedorId ?? null] as const,
} as const;

export const conceptosCosto = {
  all: ["conceptos-costo"] as const,
  byEmbarque: (embarqueId: string) => ["conceptos-costo", embarqueId] as const,
} as const;
