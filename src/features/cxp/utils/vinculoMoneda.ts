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

/** Contrato del trigger tg_pfc_validar_vinculo_costo: misma moneda o MXN↔USD. */
export function monedasVinculoCompatibles(monedaCosto: string, monedaFactura: string): boolean {
  const costo = monedaCosto.trim().toUpperCase();
  const factura = monedaFactura.trim().toUpperCase();
  return !!costo && !!factura && (costo === factura ||
    (["MXN", "USD"].includes(costo) && ["MXN", "USD"].includes(factura)));
}

export function avisoMonedasVinculo(monedaCosto: string, monedaFactura: string): string | null {
  if (monedasVinculoCompatibles(monedaCosto, monedaFactura)) return null;
  return `Esta vinculación ${monedaFactura.trim().toUpperCase()}/${monedaCosto.trim().toUpperCase()} todavía no está disponible. ` +
    "Conserva las monedas reales del documento y del costo; desmarca este vínculo para continuar sin asociarlo.";
}

/** Pesos mexicanos por una unidad de una moneda admitida para conversión. */
function factorMxn(moneda: string, tc: TcPivote | null | undefined): number | null {
  if (moneda === "MXN") return 1;
  return moneda === "USD" && tc && Number.isFinite(tc.usdMxn) && tc.usdMxn > 0 ? tc.usdMxn : null;
}

/**
 * Factor para pasar de `monedaConcepto` a `monedaFactura`.
 * `1` cuando son la misma moneda; `null` si el cruce no está admitido o falta T/C.
 */
export function factorConversion(
  monedaConcepto: string,
  monedaFactura: string,
  tc: TcPivote | null | undefined,
): number | null {
  if (!monedasVinculoCompatibles(monedaConcepto, monedaFactura)) return null;
  const costo = monedaConcepto.trim().toUpperCase();
  const factura = monedaFactura.trim().toUpperCase();
  if (costo === factura) return 1;
  const origen = factorMxn(costo, tc);
  const destino = factorMxn(factura, tc);
  if (origen === null || destino === null) return null;
  return origen / destino;
}

/** Convierte `monto` sólo para un vínculo admitido. `null` si falta soporte o T/C. */
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

/** Estado monetario del renglón, compartido por la selección y sus avisos. */
export function resumirMonedaVinculo(params: {
  monedaCosto: string; monedaFactura: string; montoCosto: number;
  montoCapturado?: number; tc: TcPivote | null;
}) {
  const { monedaCosto, monedaFactura, montoCosto, montoCapturado, tc } = params;
  const mismaMoneda = monedaCosto.trim().toUpperCase() === monedaFactura.trim().toUpperCase();
  const errorMoneda = avisoMonedasVinculo(monedaCosto, monedaFactura);
  const factor = factorConversion(monedaCosto, monedaFactura, tc);
  const cotizadoEnFactura = convertirMonto(montoCosto, monedaCosto, monedaFactura, tc);
  const sinTc = !errorMoneda && !mismaMoneda && cotizadoEnFactura === null;
  const excede = montoCapturado !== undefined && excedeCotizadoConTc({
    montoCapturado, montoCotizado: montoCosto, factorDof: factor, mismaMoneda,
  });
  const implicito = montoCapturado !== undefined && !mismaMoneda && !errorMoneda
    ? tcImplicito(montoCapturado, montoCosto) : null;
  return { mismaMoneda, errorMoneda, factor, cotizadoEnFactura, sinTc, excede, implicito,
    desviado: desviacionTcExcedida(implicito, factor) };
}
