/**
 * Atajos puros de reparto del cobro en lote de cliente.
 * Sin estado ni React: se prueban de forma aislada.
 */
import { round2 } from "@/features/cxp/services";
import { ordenarFifo } from "@/lib/domain/fifoVencimiento";
import { TOLERANCIA_CENTAVOS } from "./cobroLoteValidaciones";
import type { FacturaCobroCandidata, RenglonCobro } from "./pagoClienteLote";

/** Facturas ordenadas FIFO (lo que vence antes primero). */
export function ordenFifo(facturas: FacturaCobroCandidata[]): FacturaCobroCandidata[] {
  return ordenarFifo(facturas);
}

/**
 * Sube el importe de una factura a su saldo, sin rebasar lo que queda sin
 * asignar del depósito.
 */
export function asignarSaldoFactura(
  facturas: FacturaCobroCandidata[],
  renglones: RenglonCobro[],
  facturaId: string,
  sinAsignar: number,
): RenglonCobro[] {
  const factura = facturas.find((f) => f.factura_id === facturaId);
  if (!factura) return renglones;
  const actual = renglones.find((r) => r.factura_id === facturaId)?.monto ?? 0;
  const techo = round2(actual + Math.max(0, sinAsignar));
  const monto = round2(Math.min(round2(factura.saldo), techo));
  return renglones.map((r) => (r.factura_id === facturaId ? { ...r, monto } : r));
}

/**
 * Reparte el sobrante entre las facturas con saldo pendiente, en orden FIFO.
 */
export function asignarSobrante(
  facturas: FacturaCobroCandidata[],
  renglones: RenglonCobro[],
  sinAsignar: number,
): RenglonCobro[] {
  let restante = round2(Math.max(0, sinAsignar));
  if (restante <= TOLERANCIA_CENTAVOS) return renglones;
  const siguiente = new Map(renglones.map((r) => [r.factura_id, r.monto]));

  for (const f of ordenFifo(facturas)) {
    if (restante <= TOLERANCIA_CENTAVOS) break;
    const actual = siguiente.get(f.factura_id) ?? 0;
    const hueco = round2(round2(f.saldo) - actual);
    if (hueco <= TOLERANCIA_CENTAVOS) continue;
    const suma = round2(Math.min(hueco, restante));
    siguiente.set(f.factura_id, round2(actual + suma));
    restante = round2(restante - suma);
  }

  return renglones.map((r) => ({ ...r, monto: siguiente.get(r.factura_id) ?? r.monto }));
}
