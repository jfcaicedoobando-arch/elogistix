/**
 * Cálculos derivados del formulario de "Registrar pago" (extraído de
 * `DialogRegistrarPago` para mantener el componente ≤200 líneas).
 */
import { TOLERANCIA_SOBREPAGO } from "@/lib/financial/toleranciaPago";
import { validarFechaPago } from "@/features/facturacion/domain/validarFechaPago";

export interface RatesTc {
  usdMxn: number;
  eurMxn: number;
  /** EC-10: true cuando el TC viene del respaldo operativo (no fiscal). */
  esFallback?: boolean;
}

/**
 * Aplica el TC pesos-por-divisa igual que `public.convertir_monto_pago_a_factura`:
 * pago en MXN sobre factura extranjera divide; pago extranjero sobre factura en
 * MXN multiplica. Sin TC devuelve 0 (nunca paridad 1:1).
 */
export function aplicarTcPago(
  monto: number,
  monedaPago: string,
  monedaFactura: string,
  tcPago: number | null,
): number {
  if (monedaPago === monedaFactura) return monto;
  if (tcPago === null || !(tcPago > 0)) return 0;
  return monedaPago === "MXN"
    ? Math.round((monto / tcPago) * 10000) / 10000
    : Math.round(monto * tcPago * 10000) / 10000;
}


/**
 * TC que espera la BD en `pagos_factura.tipo_cambio`: **pesos por unidad de
 * divisa** (p. ej. 17.0627 MXN/USD), la misma convención de
 * `public.convertir_monto_pago_a_factura`. Antes aquí se mandaba la razón
 * pago→factura (0.0586 USD/MXN) y el trigger `trg_pagos_factura_monto_convertido`
 * dividía entre ella, inflando el monto aplicado (~×291).
 * `null` = cruce no soportado por la BD (USD↔EUR) o sin TC confiable.
 */
export function tcParaPago(
  monedaPago: string,
  monedaFactura: string,
  rates: RatesTc | undefined,
): number | null {
  if (monedaPago === monedaFactura) return 1;
  const extranjera = monedaPago === "MXN" ? monedaFactura : monedaPago;
  // La BD sólo convierte cruces con MXN en una de las patas.
  if (monedaPago !== "MXN" && monedaFactura !== "MXN") return null;
  const tc = extranjera === "USD" ? rates?.usdMxn : extranjera === "EUR" ? rates?.eurMxn : null;
  return tc && tc > 1 ? tc : null;
}

export interface DerivadosPago {
  montoNum: number;
  montoAplicado: number;
  tipoCambio: number;
  excede: boolean;
  tcBloqueado: boolean;
  /** EC-10: conversión cross-moneda apoyada en el TC de respaldo. */
  tcRespaldo: boolean;
  /** Cruce USD↔EUR: la BD no lo convierte (LC_PAGO_CRUCE_NO_SOPORTADO). */
  cruceNoSoportado: boolean;
  errorFecha: string | null;
  /** B-4 (v14-2): factura PUE con cobro menor al saldo (PUE = una exhibición). */
  pueIncompleto: boolean;
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
  /** B-4: método de pago de la factura; `PUE` exige liquidar en una exhibición. */
  metodoPagoFactura?: string | null;
}): DerivadosPago {
  const montoNum = Number(a.monto) || 0;
  const tcPago = tcParaPago(a.monedaPago, a.monedaFactura, a.rates);
  // El equivalente en pantalla se calcula con el MISMO TC que guardará la BD
  // (pesos por divisa), así el "Equivalente" coincide con el monto aplicado real.
  const montoAplicado = aplicarTcPago(montoNum, a.monedaPago, a.monedaFactura, tcPago);
  // BUG-15: tolerancia canónica de sobrepago (medio centavo) compartida con
  // CobroLoteRenglon — antes aquí era 0.01 y allá 0.009.
  const excede = montoAplicado > a.saldo + TOLERANCIA_SOBREPAGO;
  const tipoCambio = tcPago ?? 0;
  // FE-01 / UIA-01: cross-moneda sin TC confiable (p. ej. exchange-rates caído)
  // → bloqueamos el submit en vez de dejar el insert reventar contra el CHECK
  // (tipo_cambio > 0) con un 23514 crudo.
  // EC-10: si el TC disponible es el respaldo operativo (esFallback) y el cobro
  // requiere conversión, también bloqueamos: un REP timbrado con TC estimado es
  // un error fiscal, no sólo de visualización.
  const tcRespaldo = a.monedaPago !== a.monedaFactura && a.rates?.esFallback === true;
  // La BD sólo soporta cruces con MXN en una pata (LC_PAGO_CRUCE_NO_SOPORTADO).
  const cruceNoSoportado =
    a.monedaPago !== a.monedaFactura && a.monedaPago !== "MXN" && a.monedaFactura !== "MXN";
  const tcBloqueado = tcRespaldo || cruceNoSoportado || tcPago === null;
  // FE-03 / UIA-06: fecha futura o anterior a la emisión distorsiona REP y aging.
  const errorFecha = validarFechaPago(a.fecha, a.hoy, a.fechaEmision);
  // B-4 (v14-2): PUE no admite abonos — el cobro debe liquidar el saldo
  // (misma tolerancia de 5 centavos que el trigger `_assert_pago_pue_exhibicion_unica`).
  const pueIncompleto =
    a.metodoPagoFactura === "PUE" && montoAplicado > 0 && montoAplicado < a.saldo - 0.05;
  return {
    montoNum,
    montoAplicado,
    tipoCambio,
    excede,
    tcBloqueado,
    tcRespaldo,
    cruceNoSoportado,
    errorFecha,
    pueIncompleto,
    invalido: montoNum <= 0 || excede || tcBloqueado || errorFecha !== null || pueIncompleto,
  };
}
