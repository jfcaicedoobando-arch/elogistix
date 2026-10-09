/**
 * Política financiera del P&L de embarque: umbrales de alerta y su cálculo.
 * Extraído de `TabPnl.tsx` (auditoría 2026-07-29, hallazgo O1 / S1-04):
 * los literales 10% (sobrecosto) y 15% (margen mínimo) vivían hardcodeados
 * en JSX, invisibles para otros consumidores del P&L.
 *
 * NO confundir con `margenTono` de `src/lib/ui/margen.ts`
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
  utilidadReal: number | null;
  margenReal: number | null;
  /**
   * v13.823.366 — No hay venta ni costo real: no es una desviación financiera,
   * es que la operación no ha empezado a facturarse. Con esta bandera el tab
   * muestra contexto en vez de "Venta facturada menor a presupuestada" y Δ -100%.
   *
   * P1-3 — Ya no depende del estado operativo: un embarque Confirmado con
   * facturas en borrador (venta real 0) tampoco tiene desviación real.
   */
  sinActividadReal: boolean;
  alertaSobrecosto: boolean;
  alertaVenta: boolean;
  alertaMargen: boolean;
}

function calcularRentabilidad(ventaReal: number | null, costoReal: number | null, incompleto: boolean) {
  const resultado = ventaReal !== null && costoReal !== null ? ventaReal - costoReal : NaN;
  const utilidadReal = incompleto || !Number.isFinite(resultado)
    ? null : resultado;
  const margen = utilidadReal !== null && ventaReal !== null && ventaReal > 0
    ? (utilidadReal / ventaReal) * 100 : NaN;
  const margenReal = Number.isFinite(margen) ? margen : null;
  return { utilidadReal, margenReal };
}

export function calcularAlertasPnl(args: {
  ventaReal: number | null;
  costoReal: number | null;
  ventaPresup: number;
  costoPresup: number;
  /** Δ% del costo real vs presupuestado (salida de `deltaPnl`). */
  deltaCostoPct: number;
  /** Estado del embarque; sólo informativo para el copy de los avisos. */
  estadoEmbarque?: string | null;
  costosIncompletos?: boolean;
  ingresosIncompletos?: boolean;
  /** Documentos emitidos mantienen actividad incluso si una NC deja el neto en cero. */
  actividadIngresos?: boolean;
}): AlertasPnl {
  const { ventaReal, costoReal, ventaPresup, costoPresup, deltaCostoPct } = args;
  const { utilidadReal, margenReal } = calcularRentabilidad(ventaReal, costoReal,
    Boolean(args.costosIncompletos || args.ingresosIncompletos));
  const sinActividadReal = ventaReal === 0 && costoReal === 0
    && !args.actividadIngresos && !args.ingresosIncompletos;
  if (sinActividadReal) {
    return {
      utilidadReal, margenReal, sinActividadReal,
      alertaSobrecosto: false, alertaVenta: false, alertaMargen: false,
    };
  }
  return {
    utilidadReal,
    margenReal,
    sinActividadReal,
    alertaSobrecosto: costoPresup > 0 && deltaCostoPct > PNL_UMBRAL_SOBRECOSTO_PCT,
    alertaVenta: !args.ingresosIncompletos && ventaReal !== null && ventaPresup > 0 && ventaReal < ventaPresup,
    alertaMargen: margenReal !== null && ventaReal !== null && ventaReal > 0 && margenReal < PNL_UMBRAL_MARGEN_MIN_PCT,
  };
}
