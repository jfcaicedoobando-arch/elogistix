/**
 * Política financiera del P&L de embarque: umbrales de alerta y su cálculo.
 * Extraído de `TabPnl.tsx` (auditoría 2026-07-29, hallazgo O1 / S1-04):
 * los literales 10% (sobrecosto) y 15% (margen mínimo) vivían hardcodeados
 * en JSX, invisibles para otros consumidores del P&L.
 *
 * NO confundir con `MARGIN_THRESHOLDS` de `src/constants/reportes.ts`
 * (escala 20/10): aquella colorea badges de rentabilidad por cliente en
 * Reportes; esta gobierna las alertas del P&L de embarque. Si un segundo
 * módulo (dashboard ejecutivo, profit) adopta estas alertas, promover este
 * archivo a `src/lib/financial/` en vez de duplicarlo.
 */

/** Sobrecosto: costo real supera al presupuestado en más de este %. */
export const PNL_UMBRAL_SOBRECOSTO_PCT = 10;

/** Margen mínimo: margen real por debajo de este % dispara alerta. */
export const PNL_UMBRAL_MARGEN_MIN_PCT = 15;

export interface AlertasPnl {
  utilidadReal: number;
  margenReal: number;
  alertaSobrecosto: boolean;
  alertaVenta: boolean;
  alertaMargen: boolean;
}

export function calcularAlertasPnl(args: {
  ventaReal: number;
  costoReal: number;
  ventaPresup: number;
  costoPresup: number;
  /** Δ% del costo real vs presupuestado (salida de `deltaPnl`). */
  deltaCostoPct: number;
}): AlertasPnl {
  const { ventaReal, costoReal, ventaPresup, costoPresup, deltaCostoPct } = args;
  const utilidadReal = ventaReal - costoReal;
  const margenReal = ventaReal > 0 ? (utilidadReal / ventaReal) * 100 : 0;
  return {
    utilidadReal,
    margenReal,
    alertaSobrecosto: costoPresup > 0 && deltaCostoPct > PNL_UMBRAL_SOBRECOSTO_PCT,
    alertaVenta: ventaPresup > 0 && ventaReal < ventaPresup,
    alertaMargen: ventaReal > 0 && margenReal < PNL_UMBRAL_MARGEN_MIN_PCT,
  };
}
