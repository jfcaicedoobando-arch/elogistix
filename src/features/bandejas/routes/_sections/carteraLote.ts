/**
 * Derivación del lote de cobro a partir de la selección en Cartera.
 * Regla: mismo cliente, misma moneda y al menos dos facturas.
 * v13.592.0: se excluyen facturas con cancelación en trámite ante el SAT
 * (`cancellation_status` = pending | verifying) porque la base de datos
 * rechaza sus cobros (LC_FACTURA_EN_CANCELACION).
 */
import type { CarteraRow } from "./carteraColumns";
import type { FacturaCobroCandidata } from "@/features/facturacion/services/pagoClienteLote";

export interface LoteCobroSeleccion {
  clienteId: string;
  clienteNombre: string;
  moneda: string;
  facturas: FacturaCobroCandidata[];
}

/** True si la factura tiene una solicitud de cancelación viva ante el SAT. */
export function enTramiteCancelacion(row: { cancellation_status?: string | null }): boolean {
  const s = row.cancellation_status ?? "none";
  return s === "pending" || s === "verifying";
}

export function hayEnTramiteCancelacion(seleccionadas: CarteraRow[]): boolean {
  return seleccionadas.some((r) => enTramiteCancelacion(r));
}

export function derivarLoteCobro(seleccionadas: CarteraRow[]): LoteCobroSeleccion | null {
  if (seleccionadas.length < 2) return null;
  if (hayEnTramiteCancelacion(seleccionadas)) return null;
  const primera = seleccionadas[0];
  const mismoCliente = seleccionadas.every((r) => r.cliente_id === primera.cliente_id);
  const mismaMoneda = seleccionadas.every((r) => r.moneda === primera.moneda);
  if (!mismoCliente || !mismaMoneda || !primera.cliente_id) return null;
  return {
    clienteId: primera.cliente_id,
    clienteNombre: primera.cliente_nombre ?? "",
    moneda: primera.moneda,
    facturas: seleccionadas.map((r) => ({
      factura_id: r.factura_id,
      numero: r.numero,
      fecha_vencimiento: r.fecha_vencimiento,
      saldo: Number(r.saldo ?? 0),
    })),
  };
}
