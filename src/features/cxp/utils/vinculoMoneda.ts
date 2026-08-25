/**
 * Conversión de moneda al vincular conceptos de costo con una factura de
 * proveedor (wizard "Capturar factura de proveedor", paso 3).
 *
 * Regla del modelo: **los montos vinculados siempre se capturan en la moneda
 * de la factura**, porque el tope se compara contra su subtotal y los ajustes
 * de costo se crean con `proveedor_facturas.moneda`. Cuando el costo cotizado
 * está en otra moneda (p. ej. costo USD y factura MXN) se convierte con el
 * T/C DOF de la fecha de emisión, usando MXN como moneda pivote.
 *
 * Funciones puras: sin React ni Supabase.
 */
import { roundMoney } from "@/lib/financial/financialUtils";

/** Desviación tolerada entre el T/C implícito y el T/C DOF (2%). */
export const TOLERANCIA_DESVIACION_TC = 0.02;

export interface TcPivote {
  /** Pesos por dólar (DOF). */
  usdMxn: number;
  /** Pesos por euro (DOF); `null` si el día no publicó euro. */
  eurMxn: number | null;
}

/** Pesos mexicanos por una unidad de `moneda`. `null` si no hay T/C. */
function factorMxn(moneda: string, tc: TcPivote | null | undefined): number | null {
  if (moneda === "MXN") return 1;
  if (!tc) return null;
  if (moneda === "USD") return tc.usdMxn > 0 ? tc.usdMxn : null;
  if (moneda === "EUR") return tc.eurMxn && tc.eurMxn > 0 ? tc.eurMxn : null;
  return null;
}

/**
 * Factor para pasar de `monedaConcepto` a `monedaFactura`.
 * `1` cuando son la misma moneda; `null` cuando falta el T/C necesario.
 */
export function factorConversion(
  monedaConcepto: string,
  monedaFactura: string,
  tc: TcPivote | null | undefined,
): number | null {
  if (monedaConcepto === monedaFactura) return 1;
  const origen = factorMxn(monedaConcepto, tc);
  const destino = factorMxn(monedaFactura, tc);
  if (origen === null || destino === null) return null;
  return origen / destino;
}

/** Convierte `monto` de `monedaConcepto` a `monedaFactura`. `null` sin T/C. */
export function convertirMonto(
  monto: number,
  monedaConcepto: string,
  monedaFactura: string,
  tc: TcPivote | null | undefined,
): number | null {
  const factor = factorConversion(monedaConcepto, monedaFactura, tc);
  if (factor === null) return null;
  return roundMoney(monto * factor);
}

/**
 * T/C implícito que resulta de lo capturado: `montoFactura / montoConcepto`.
 * Sirve para que el usuario vea a qué tipo de cambio cierra la conciliación.
 */
export function tcImplicito(montoFactura: number, montoConcepto: number): number | null {
  if (!(montoConcepto > 0) || !(montoFactura > 0)) return null;
  return montoFactura / montoConcepto;
}

/** `true` si el T/C implícito se desvía más de la tolerancia respecto al factor DOF. */
export function desviacionTcExcedida(
  implicito: number | null,
  factorDof: number | null,
): boolean {
  if (implicito === null || factorDof === null || factorDof <= 0) return false;
  return Math.abs(implicito - factorDof) / factorDof > TOLERANCIA_DESVIACION_TC;
}

/**
 * `true` si el importe capturado supera lo cotizado *más allá de lo explicable
 * por el tipo de cambio*.
 *
 * En conceptos en otra moneda, capturar 872.57 MXN contra un costo de 51 USD
 * (≈865.20 MXN al DOF) NO es un exceso: es la diferencia normal de T/C. Sólo
 * se marca exceso cuando el T/C implícito rebasa la tolerancia del 2%.
 */
export function excedeCotizadoConTc(params: {
  montoCapturado: number;
  montoCotizado: number;
  factorDof: number | null;
  mismaMoneda: boolean;
}): boolean {
  const { montoCapturado, montoCotizado, factorDof, mismaMoneda } = params;
  if (!(montoCotizado > 0)) return false;
  if (mismaMoneda) return montoCapturado - montoCotizado > 0.01;
  const implicito = tcImplicito(montoCapturado, montoCotizado);
  if (implicito === null || factorDof === null || factorDof <= 0) return false;
  return (implicito - factorDof) / factorDof > TOLERANCIA_DESVIACION_TC;
}
