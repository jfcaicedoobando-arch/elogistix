/**
 * Conversión de una nota de crédito de proveedor a la moneda de la factura.
 * Espejo en TypeScript de `public.monto_pago_en_moneda_factura` (BD): el tipo
 * de cambio se expresa en la convención mexicana, MXN por 1 unidad de moneda
 * extranjera. Sin tipo de cambio devuelve `null` — nunca 1:1 silencioso.
 */
import type { MonedaNotaCreditoProveedor as MonedaNC } from "@/features/cxp/types";

/** `true` cuando el cruce no es convertible (USD↔EUR: no hay TC cruzado). */
export function esCruceNoConvertible(monedaNc: MonedaNC, monedaFactura: MonedaNC): boolean {
  return monedaNc !== monedaFactura && monedaNc !== "MXN" && monedaFactura !== "MXN";
}

/** Moneda extranjera del par; `null` si ambas son MXN o el cruce es inválido. */
export function monedaExtranjeraDelPar(
  monedaNc: MonedaNC,
  monedaFactura: MonedaNC,
): MonedaNC | null {
  if (monedaNc === monedaFactura) return null;
  if (esCruceNoConvertible(monedaNc, monedaFactura)) return null;
  return monedaNc === "MXN" ? monedaFactura : monedaNc;
}

/**
 * Monto de la NC valuado en la moneda de la factura.
 * Devuelve `null` cuando falta el tipo de cambio o el cruce no es convertible.
 */
export function montoNcEnMonedaFactura(
  monto: number,
  monedaNc: MonedaNC,
  monedaFactura: MonedaNC,
  tipoCambio: number | null,
): number | null {
  if (!Number.isFinite(monto)) return null;
  if (monedaNc === monedaFactura) return monto;
  if (esCruceNoConvertible(monedaNc, monedaFactura)) return null;
  const tc = Number(tipoCambio ?? 0);
  if (!Number.isFinite(tc) || tc <= 0) return null;
  // MXN → extranjera: se divide; extranjera → MXN: se multiplica.
  return monedaNc === "MXN" ? monto / tc : monto * tc;
}
