import Decimal from "decimal.js";

/** Local candidate only. Enable only after destination/security acceptance. */
export const SEGURO_FACTURA_SELECTOR_ENABLED = false;
export const SEGURO_FACTURA_SELECTOR_VERSION = "selector148-v1";
export const SEGURO_FACTURA_SELECTOR_ERROR = "No se pudieron cargar las facturas del embarque.";

/** Mirrors numeric(14,2) input coercion only; eligibility is never calculated here. */
export function normalizarPrimaSeguro(value: number | string): string | null {
  try {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(String(value))) return null;
    const prima = new Decimal(value).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
    if (!prima.isFinite() || prima.lt(0) || prima.gte("1000000000000")) return null;
    return prima.isZero() ? "0.00" : prima.toFixed(2);
  } catch {
    return null;
  }
}
