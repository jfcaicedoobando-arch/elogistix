/**
 * FIX 9.1 (WAVE 2) — Agregados del proveedor sin mezclar divisas.
 *
 * Antes, el detalle de proveedor sumaba `monto` de todos los conceptos de costo
 * sin importar la moneda: un concepto de 1,000 USD se sumaba como si fueran
 * 1,000 MXN. Aquí se agrupa por moneda nativa y se calcula un único
 * equivalente en MXN con el tipo de cambio del día; lo que no se puede
 * convertir se reporta aparte para que la UI lo advierta en lugar de mentir.
 */
import { aMxn } from "@/lib/financial/convertir";
import { roundMoney } from "@/lib/financial/financialUtils";

export interface OperacionMonto {
  monto: number;
  moneda?: string | null;
  estadoLiquidacion?: string | null;
}

export interface AgregadosProveedor {
  /** Equivalente en MXN de todo lo costeado (conceptos vigentes). */
  totalFacturado: number;
  totalPagado: number;
  totalPendiente: number;
  /** Totales en moneda nativa, para mostrar el desglose sin conversión. */
  porMoneda: Record<string, number>;
  /** Monedas con monto > 0 que no se pudieron convertir a MXN. */
  monedasSinTc: string[];
}

const money = (n: number): number => roundMoney(n);

function normalizaMoneda(moneda?: string | null): string {
  const m = (moneda ?? "MXN").toUpperCase().trim();
  return m === "" ? "MXN" : m;
}

export function calcularAgregadosProveedor(
  operaciones: readonly OperacionMonto[],
  tcUsdMxn: number,
): AgregadosProveedor {
  const porMoneda: Record<string, number> = {};
  const pagadoPorMoneda: Record<string, number> = {};

  for (const op of operaciones) {
    const moneda = normalizaMoneda(op.moneda);
    const monto = Number.isFinite(op.monto) ? Number(op.monto) : 0;
    porMoneda[moneda] = money((porMoneda[moneda] ?? 0) + monto);
    if (op.estadoLiquidacion === "Pagado") {
      pagadoPorMoneda[moneda] = money((pagadoPorMoneda[moneda] ?? 0) + monto);
    }
  }

  let totalFacturado = 0;
  let totalPagado = 0;
  const monedasSinTc: string[] = [];

  for (const [moneda, monto] of Object.entries(porMoneda)) {
    // Sólo MXN (1:1) y USD (con TC del día) son convertibles aquí; el resto se
    // reporta como "sin TC" en lugar de convertirse con una tasa equivocada.
    const tc = moneda === "USD" ? tcUsdMxn : moneda === "MXN" ? 1 : 0;
    const conv = aMxn(monto, moneda, tc);
    if (conv.completo) {
      totalFacturado = money(totalFacturado + conv.monto);
      const pagadoNativo = pagadoPorMoneda[moneda] ?? 0;
      const convPagado = aMxn(pagadoNativo, moneda, tc);
      if (convPagado.completo) totalPagado = money(totalPagado + convPagado.monto);
    } else if (monto !== 0) {
      monedasSinTc.push(moneda);
    }
  }

  return {
    totalFacturado,
    totalPagado,
    totalPendiente: money(totalFacturado - totalPagado),
    porMoneda,
    monedasSinTc,
  };
}
