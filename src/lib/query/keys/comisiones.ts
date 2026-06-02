export const comisiones = {
  all: ["comisiones"] as const,
  devengadas: (filtros?: unknown) => ["comisiones", "devengadas", filtros ?? null] as const,
  liquidaciones: (filtros?: unknown) => ["comisiones", "liquidaciones", filtros ?? null] as const,
  liquidacion: (id: string) => ["comisiones", "liquidacion", id] as const,
  vendedorasConfig: () => ["comisiones", "vendedoras-config"] as const,
  embarquesSinVendedora: () => ["comisiones", "embarques-sin-vendedora"] as const,
  usuariosVendedores: () => ["comisiones", "usuarios-vendedores"] as const,
} as const;
