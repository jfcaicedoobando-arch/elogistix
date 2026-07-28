/**
 * B-082 — Cálculo puro del saldo de una factura en el portal cliente.
 *
 * El saldo que ve el cliente debe descontar tanto los pagos aplicados como
 * las notas de crédito aplicadas. Sin I/O para poder testearse aislado.
 */
import { sumarMontos } from "@/lib/financial/financialUtils";

export interface PagoAplicadoLike {
  monto_aplicado_factura?: number | string | null;
}

export interface NotaCreditoAplicadaLike {
  monto?: number | string | null;
}

export interface SaldoFacturaPortal {
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

export function calcularSaldoFacturaPortal(
  total: number,
  pagos: readonly PagoAplicadoLike[] = [],
  notasCredito: readonly NotaCreditoAplicadaLike[] = [],
): SaldoFacturaPortal {
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
