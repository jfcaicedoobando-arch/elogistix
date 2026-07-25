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
  conciliacionEmbarques: (filtros: ConciliacionFiltros) =>
    ["compras", "conciliacion-embarques", filtros] as const,
  conciliacionDetalle: (embarqueId: string | null) =>
    ["compras", "conciliacion-detalle", embarqueId] as const,
  conciliacionHuerfanas: (embarqueId: string | null) =>
    ["compras", "conciliacion-huerfanas", embarqueId] as const,
  notasCreditoGlobal: (filtros: NotasCreditoFiltros) =>
    ["compras", "notas-credito-global", filtros] as const,
  pagosGlobal: (filtros: PagosFiltros) =>
    ["compras", "pagos-global", filtros] as const,
  reportes: (filtros: ReportesFiltros) =>
    ["compras", "reportes", filtros] as const,
  exchangeRatesDofToday: () => ["compras", "exchange-rates-dof-today"] as const,
} as const;
