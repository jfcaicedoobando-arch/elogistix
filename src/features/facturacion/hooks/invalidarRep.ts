/**
 * Invalidaciones compartidas tras timbrar/cancelar un REP.
 *
 * v13.549.0 — el auto-REP que sigue al registro del pago llamaba al servicio
 * directo y no refrescaba nada: el historial de pagos quedaba congelado en
 * "REP pendiente" y el botón "Timbrar REP" seguía visible aunque el REP ya
 * existía. Centralizar las invalidaciones evita que se vuelva a olvidar.
 */
import type { QueryClient } from "@tanstack/react-query";
import { lecturasAfectadasPorRep } from "../application/efectosRep";

export function invalidarTrasRep(qc: QueryClient, facturaId?: string): void {
  for (const queryKey of lecturasAfectadasPorRep(facturaId)) {
    void qc.invalidateQueries({ queryKey });
  }
}
