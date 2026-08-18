/**
 * Cálculos derivados del formulario de "Registrar pago" (extraído de
 * `DialogRegistrarPago` para mantener el componente ≤200 líneas).
 */
import { factorEntreMonedas } from "@/lib/financial/convertir";
import { TOLERANCIA_SOBREPAGO } from "@/lib/financial/toleranciaPago";
import { validarFechaPago } from "@/features/facturacion/domain/validarFechaPago";

export interface RatesTc {
  usdMxn: number;
  eurMxn: number;
  /** EC-10: true cuando el TC viene del respaldo operativo (no fiscal). */
  esFallback?: boolean;
}

export function convertirAMonedaFactura(
  monto: number,
  monedaPago: string,
  monedaFactura: string,
  rates: RatesTc | undefined,
): number {
  // FIX C6: el factor sale del canon único (MXN como puente). Sin TC confiable
  // devuelve null y aquí se traduce a 0: nunca se trata USD/EUR como MXN.
  const factor = factorEntreMonedas(monedaPago, monedaFactura, {
    usd: rates?.usdMxn,
    eur: rates?.eurMxn,
  });
  return factor === null ? 0 : monto * factor;
}

export interface DerivadosPago {
  montoNum: number;
  montoAplicado: number;
  tipoCambio: number;
  excede: boolean;
  tcBloqueado: boolean;
  /** EC-10: conversión cross-moneda apoyada en el TC de respaldo. */
  tcRespaldo: boolean;
  errorFecha: string | null;
  invalido: boolean;
}

/** Deriva montos, TC y validaciones del renglón de captura del pago. */
export function derivarEstadoPago(a: {
  monto: string;
  monedaPago: string;
  fecha: string;
  hoy: string;
  monedaFactura: string;
  fechaEmision?: string | null;
  saldo: number;
  rates: RatesTc | undefined;
}): DerivadosPago {
  const montoNum = Number(a.monto) || 0;
  const montoAplicado = convertirAMonedaFactura(
    montoNum,
    a.monedaPago,
    a.monedaFactura,
    a.rates,
  );
  // BUG-15: tolerancia canónica de sobrepago (medio centavo) compartida con
  // CobroLoteRenglon — antes aquí era 0.01 y allá 0.009.
  const excede = montoAplicado > a.saldo + TOLERANCIA_SOBREPAGO;
  const tipoCambio = montoNum > 0 ? montoAplicado / montoNum : 1;
  // FE-01 / UIA-01: cross-moneda sin TC confiable (factorEntreMonedas === null,
  // p. ej. exchange-rates caído) → bloqueamos el submit en vez de dejar el
  // insert reventar contra CHECK (tipo_cambio > 0) con un 23514 crudo.
  // EC-10: si el TC disponible es el respaldo operativo (esFallback) y el cobro
  // requiere conversión, también bloqueamos: un REP timbrado con TC estimado es
  // un error fiscal, no sólo de visualización.
  const tcRespaldo = a.monedaPago !== a.monedaFactura && a.rates?.esFallback === true;
  const tcBloqueado =
    tcRespaldo ||
    factorEntreMonedas(a.monedaPago, a.monedaFactura, {
      usd: a.rates?.usdMxn,
      eur: a.rates?.eurMxn,
    }) === null;
  // FE-03 / UIA-06: fecha futura o anterior a la emisión distorsiona REP y aging.
  const errorFecha = validarFechaPago(a.fecha, a.hoy, a.fechaEmision);
  return {
    montoNum,
    montoAplicado,
    tipoCambio,
    excede,
    tcBloqueado,
    tcRespaldo,
    errorFecha,
    invalido: montoNum <= 0 || excede || tcBloqueado || errorFecha !== null,
  };
}
