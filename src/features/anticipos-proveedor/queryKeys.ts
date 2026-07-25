/** Query keys del feature Anticipos a Proveedor (QW6). */
export const anticiposProveedorKeys = {
  all: ["anticipos-proveedor"] as const,
  list: (filtros?: unknown) => ["anticipos-proveedor", "list", filtros ?? null] as const,
  aplicacionesPorFactura: (facturaId?: string | null) =>
    ["anticipos-proveedor", "aplicaciones-factura", facturaId ?? null] as const,
} as const;
