/**
 * Invalidaciones compartidas tras timbrar/cancelar un REP.
 *
 * v13.549.0 — el auto-REP que sigue al registro del pago llamaba al servicio
 * directo y no refrescaba nada: el historial de pagos quedaba congelado en
 * "REP pendiente" y el botón "Timbrar REP" seguía visible aunque el REP ya
 * existía. Centralizar las invalidaciones evita que se vuelva a olvidar.
 */
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { invalidateProfitDependencies } from "@/features/profit/hooks/invalidateProfitDependencies";

export function invalidarTrasRep(qc: QueryClient, facturaId?: string): void {
  if (facturaId) {
    qc.invalidateQueries({ queryKey: queryKeys.facturas.pagos(facturaId) });
  } else {
    qc.invalidateQueries({ queryKey: queryKeys.facturas.pagosAll });
  }
  qc.invalidateQueries({ queryKey: queryKeys.facturas.all });
  qc.invalidateQueries({ queryKey: queryKeys.facturacion.repPendientes });
  invalidateProfitDependencies(qc);
}
