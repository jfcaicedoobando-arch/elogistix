/**
 * P2-B (remate) — Proyección de PRESENTACIÓN de la utilidad en el tablero.
 *
 * El RPC homologa a MXN con 4 decimales (61,638.1538 / 53,137.5250) y resta en
 * crudo, así que la utilidad mostrada salía 8,500.63 mientras Costos y el P&L
 * del embarque mostraban 8,500.62. Aquí se redondea venta y costo a centavos
 * ANTES de restar, con la misma política (`roundMoney`, half-away-from-zero),
 * de modo que la utilidad visible sea exactamente venta visible − costo visible.
 *
 * NO toca SQL, tipo de cambio, impuestos ni importes persistidos: es una
 * proyección para pantalla. Los totales de tarjetas se proyectan con sus
 * PROPIOS venta/costo visibles; no se fuerza que la suma de filas coincida.
 */
import { centavosPnl } from "@/lib/formatters/pnl";

export interface FilaUtilidadVisible {
  ventaMXN: number;
  costoMXN: number;
  profitMXN: number;
  margenMXN?: number;
}

/** Margen porcentual derivado de los montos visibles (0 si no hay venta). */
function margenVisible(profit: number, venta: number): number {
  return venta > 0 ? (profit / venta) * 100 : 0;
}

export function proyectarUtilidadVisible<T extends FilaUtilidadVisible>(fila: T): T {
  const ventaMXN = centavosPnl(fila.ventaMXN);
  const costoMXN = centavosPnl(fila.costoMXN);
  const profitMXN = centavosPnl(ventaMXN - costoMXN);
  return {
    ...fila,
    ventaMXN,
    costoMXN,
    profitMXN,
    ...(typeof fila.margenMXN === "number"
      ? { margenMXN: margenVisible(profitMXN, ventaMXN) }
      : {}),
  };
}

export function proyectarFilasUtilidadVisible<T extends FilaUtilidadVisible>(filas: T[]): T[] {
  return filas.map(proyectarUtilidadVisible);
}
