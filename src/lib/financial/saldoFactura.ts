/**
 * A1 (auditoría 2026-07-29) — Canon ÚNICO del saldo de factura.
 *
 * saldo = max(0, total − Σ pagos aplicados − Σ NC aplicadas).
 * Las NC deben llegar pre-filtradas (estado "Aplicada" y sin `deleted_at`).
 * Función pura (sin I/O) para poder testearse aislada.
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

export function calcularSaldoFactura(
  total: number,
  pagos: readonly PagoAplicadoLike[] = [],
  notasCredito: readonly NotaCreditoAplicadaLike[] = [],
): SaldoFactura {
  const totalFactura = num(total);
  const pagado = sumarMontos(pagos.map((p) => num(p.monto_aplicado_factura)));
  const nc = sumarMontos(notasCredito.map((n) => num(n.monto)));
  const bruto = sumarMontos([totalFactura, -pagado, -nc]);
  const saldo = bruto > 0 ? bruto : 0;

  return {
    total: totalFactura,
    pagado,
    notasCredito: nc,
    saldo,
    liquidada: saldo < 0.01,
  };
}
