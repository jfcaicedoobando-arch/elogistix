/**
 * A1 (auditoría 2026-07-29) — Canon ÚNICO del saldo de factura en el cliente.
 *
 * saldo = max(0, total − Σ pagos vigentes − Σ NC aplicadas).
 * Las NC deben llegar pre-filtradas (estado "Aplicada" y sin `deleted_at`).
 * Función pura (sin I/O) para poder testearse aislada.
 *
 * Espejo EXACTO de `public._saldo_factura_calc` (Ola v17):
 *  - los pagos con REP cancelado están ANULADOS y no cuentan;
 *  - sólo `Cancelada` y `Sustituida` fuerzan saldo 0.
 *
 * Ola v17: se ELIMINÓ el atajo "si estado = Pagada entonces saldo 0". Ese
 * atajo hacía que el saldo dependiera del estado y el estado del saldo
 * (circularidad): una factura marcada "Pagada" cuyo único pago quedó anulado
 * por cancelación del REP seguía reportando saldo 0 (bug F1015).
 *
 * NO reimplementar esta fórmula en componentes ni services.
 */

import { sumarMontos } from "./financialUtils";

export interface PagoAplicadoLike {
  monto_aplicado_factura?: number | string | null;
  /**
   * v13.823.295 — un pago cuyo REP quedó cancelado ante el SAT está ANULADO:
   * se conserva como antecedente fiscal pero NO cuenta para cobrado ni saldo
   * (mismo criterio que `public.pago_rep_anulado`). Si la lectura no trae la
   * columna, el pago se considera vigente (compatibilidad).
   */
  estado_rep?: string | null;
}

export interface NotaCreditoAplicadaLike {
  monto?: number | string | null;
}

export interface SaldoFactura {
  total: number;
  pagado: number;
  notasCredito: number;
  saldo: number;
  liquidada: boolean;
}

const num = (v: unknown): number => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/**
 * Estados en los que la factura NO puede tener saldo por cobrar.
 * Espejo de `public._saldo_factura_calc`: 'Pagada' NO está aquí (sería
 * circular) y 'Borrador' tampoco (un CFDI sin timbrar sí se debe cobrar).
 */
export const ESTADOS_SIN_SALDO = [
  "Cancelada",
  "Sustituida",
] as const;


export function esEstadoSinSaldo(estado?: string | null): boolean {
  return !!estado && (ESTADOS_SIN_SALDO as readonly string[]).includes(estado);
}

/**
 * v13.823.295 — Pago ANULADO: su REP fue cancelado ante el SAT. No suma a
 * cobrado ni reduce el saldo (espejo de `public.pago_rep_anulado`).
 */
export function esPagoAnulado(pago: PagoAplicadoLike): boolean {
  return (pago.estado_rep ?? "").trim().toLowerCase() === "cancelado";
}

export function calcularSaldoFactura(
  total: number,
  pagos: readonly PagoAplicadoLike[] = [],
  notasCredito: readonly NotaCreditoAplicadaLike[] = [],
  estadoFactura?: string | null,
): SaldoFactura {
  const totalFactura = num(total);
  const pagado = sumarMontos(
    pagos.filter((p) => !esPagoAnulado(p)).map((p) => num(p.monto_aplicado_factura)),
  );
  const nc = sumarMontos(notasCredito.map((n) => num(n.monto)));
  const bruto = sumarMontos([totalFactura, -pagado, -nc]);
  const saldo = esEstadoSinSaldo(estadoFactura) || bruto <= 0 ? 0 : bruto;

  return {
    total: totalFactura,
    pagado,
    notasCredito: nc,
    saldo,
    liquidada: saldo < 0.01,
  };
}

