/**
 * B-082 — Saldo de una factura en el portal cliente.
 *
 * A1 (2026-07-29): la implementación vive en el canon único
 * `@/lib/financial/saldoFactura`. Este módulo se conserva como wrapper para
 * no romper la API ni los tests del portal.
 */
import {
  calcularSaldoFactura,
  type PagoAplicadoLike,
  type NotaCreditoAplicadaLike,
  type SaldoFactura,
} from "@/lib/financial/saldoFactura";

export type { PagoAplicadoLike, NotaCreditoAplicadaLike };
export type SaldoFacturaPortal = SaldoFactura;

export function calcularSaldoFacturaPortal(
  total: number,
  pagos: readonly PagoAplicadoLike[] = [],
  notasCredito: readonly NotaCreditoAplicadaLike[] = [],
): SaldoFacturaPortal {
  return calcularSaldoFactura(total, pagos, notasCredito);
}
