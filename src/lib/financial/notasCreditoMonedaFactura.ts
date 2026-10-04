/** NC en moneda de factura: mismas tasas históricas que nc_convertida_a_moneda_factura. */
import Decimal from "decimal.js";
import { tcConfiable } from "./convertir";

interface NotaConMoneda {
  monto: number;
  moneda: string;
  tipo_cambio: number | null;
}

function monedaSoportada(moneda: string): boolean {
  return moneda === "MXN" || moneda === "USD" || moneda === "EUR";
}

/**
 * Conserva el detalle y suma antes de redondear: varias NC fraccionarias en
 * otra moneda no deben perder centavos por redondeo individual. Sin TC no
 * inventa 1:1 ni omite el crédito: falla visiblemente antes de exportar/cobrar.
 */
export function notasCreditoMonedaFactura<T extends NotaConMoneda>(
  notas: readonly T[], monedaFactura: string, tipoCambioFactura: number | null | undefined,
): { notas: T[]; total: number } {
  let total = new Decimal(0);
  const convertidas = notas.map((nc) => {
    if (!monedaSoportada(nc.moneda) || !monedaSoportada(monedaFactura)) {
      throw new Error("LC_NC_MONEDA_NO_SOPORTADA: revisa la moneda de la nota de crédito y de la factura.");
    }
    let monto = new Decimal(nc.monto);
    if (nc.moneda !== monedaFactura) {
      // SQL: foreign→MXN usa TC de NC; MXN→foreign usa TC de factura;
      // foreign→foreign usa ambos. Misma moneda nunca necesita TC.
      const origen = nc.moneda === "MXN" ? 1 : tcConfiable(nc.tipo_cambio);
      const destino = monedaFactura === "MXN" ? 1 : tcConfiable(tipoCambioFactura);
      if (origen == null || destino == null) {
        throw new Error("LC_NC_MONEDA_SIN_TC: falta un tipo de cambio histórico confiable para convertir la nota de crédito.");
      }
      monto = monto.times(origen).dividedBy(destino);
    }
    total = total.plus(monto);
    return { ...nc, monto: monto.toNumber() };
  });
  return { notas: convertidas, total: total.toNumber() };
}
