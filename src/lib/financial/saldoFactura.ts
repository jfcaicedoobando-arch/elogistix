/**
 * A1 (auditoría 2026-07-29) — Canon ÚNICO del saldo de factura.
 *
 * saldo = max(0, total − Σ pagos aplicados − Σ NC aplicadas).
 * Las NC deben llegar pre-filtradas (estado "Aplicada" y sin `deleted_at`).
 * Función pura (sin I/O) para poder testearse aislada.
 *
 * BUG-2026-08-25 (facturas legacy): si el estado de la factura ya es terminal
 * (`Pagada`, `Cancelada`, `Sustituida`, `Borrador`) el saldo SIEMPRE es 0,
 * aunque falten los pagos históricos en la tabla. Sin esta regla, las
 * facturas migradas marcadas "Pagada" sin pagos capturados inflaban el
 * adeudo del estado de cuenta. Misma regla que `public.saldo_factura`.
 *
 * NO reimplementar esta fórmula en componentes ni services.
 */

import { sumarMontos } from "./financialUtils";

export interface PagoAplicadoLike {
  monto_aplicado_factura?: number | string | null;
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
 * v13.823.145 — `Borrador` SÍ genera saldo: un CFDI aún sin timbrar debe verse
 * como pendiente por cobrar (antes el encabezado mostraba "Cobrado = total" y
 * "pendiente 0" sin un solo pago capturado).
 */
export const ESTADOS_SIN_SALDO = [
  "Pagada",
  "Cancelada",
  "Sustituida",
] as const;


export function esEstadoSinSaldo(estado?: string | null): boolean {
  return !!estado && (ESTADOS_SIN_SALDO as readonly string[]).includes(estado);
}

export function calcularSaldoFactura(
  total: number,
  pagos: readonly PagoAplicadoLike[] = [],
  notasCredito: readonly NotaCreditoAplicadaLike[] = [],
  estadoFactura?: string | null,
): SaldoFactura {
  const totalFactura = num(total);
  const pagado = sumarMontos(pagos.map((p) => num(p.monto_aplicado_factura)));
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

