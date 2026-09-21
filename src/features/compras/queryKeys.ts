// 13.275.0 — Factory de query keys para el módulo Compras.
// Centraliza todas las tuplas usadas en rutas y sheets para evitar typos
// entre `queryKey` y `invalidateQueries` (bug latente frecuente).
export interface ConciliacionFiltros {
  estado: string;
  moneda: string;
  search: string;
}

export interface NotasCreditoFiltros {
  desde: string;
  hasta: string;
  moneda: string;
  estado: string;
  search: string;
}

export interface PagosFiltros {
  desde: string;
  hasta: string;
  moneda: string;
  metodoPago: string;
  search: string;
}

export interface ReportesFiltros {
  desde: string;
  hasta: string;
}

export const compras = {
  all: ["compras"] as const,
  conciliacionEmbarques: (filtros: ConciliacionFiltros, organizationId?: string | null) =>
    ["compras", "conciliacion-embarques", filtros, organizationId] as const,
  conciliacionDetalle: (embarqueId: string | null) =>
    ["compras", "conciliacion-detalle", embarqueId] as const,
  conciliacionHuerfanas: (embarqueId: string | null) =>
    ["compras", "conciliacion-huerfanas", embarqueId] as const,
  notasCreditoGlobal: (filtros: NotasCreditoFiltros, organizationId?: string | null) =>
    ["compras", "notas-credito-global", filtros, organizationId] as const,
  pagosGlobal: (filtros: PagosFiltros, organizationId?: string | null) =>
    ["compras", "pagos-global", filtros, organizationId] as const,
  reportes: (filtros: ReportesFiltros, organizationId?: string | null) =>
    ["compras", "reportes", filtros, organizationId] as const,
  exchangeRatesDofToday: () => ["compras", "exchange-rates-dof-today"] as const,
} as const;
