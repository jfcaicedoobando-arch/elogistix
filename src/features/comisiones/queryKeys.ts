export const comisiones = {
  all: ["comisiones"] as const,
  devengadas: (filtros?: unknown) => ["comisiones", "devengadas", filtros ?? null] as const,
  liquidaciones: (filtros?: unknown) => ["comisiones", "liquidaciones", filtros ?? null] as const,
  liquidacion: (id: string) => ["comisiones", "liquidacion", id] as const,
  vendedorasConfig: (scope?: unknown) => ["comisiones", "vendedoras-config", ...(scope ? [scope] : [])] as const,
  embarquesSinVendedora: () => ["comisiones", "embarques-sin-vendedora"] as const,
  usuariosVendedores: (scope?: unknown) => ["comisiones", "usuarios-vendedores", ...(scope ? [scope] : [])] as const,
  recalculoPendiente: () => ["comisiones", "recalculo-pendiente"] as const,
} as const;
