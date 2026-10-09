/**
 * Invalidaciones compartidas tras timbrar/cancelar un CFDI (factura o nota
 * de crédito).
 *
 * M-1 (revisión fix2-misc): `useTimbrarFactura`/`useCancelarFactura` sólo
 * invalidaban `facturas.all` + el hueco de facturación, y los hooks de nota de
 * crédito sólo sus propias listas: las bandejas "Por timbrar"/"Por enviar",
 * sus badges de conteo y la cartera/aging (CxC) quedaban obsoletos, así que un
 * CFDI cancelado o con NC aplicada seguía viéndose cobrable por el saldo
 * anterior. Mismo patrón que `invalidarTrasRep` (v13.549.0): centralizar las
 * invalidaciones evita que se vuelva a olvidar.
 */
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { invalidateProfitDependencies } from "@/features/profit/hooks/invalidateProfitDependencies";

export async function invalidarTrasTimbrado(qc: QueryClient, facturaId?: string): Promise<void> {
  if (facturaId) {
    qc.invalidateQueries({ queryKey: queryKeys.facturas.detail(facturaId) });
  }
  qc.invalidateQueries({ queryKey: queryKeys.facturas.all });
  // Bandejas del módulo: "Por timbrar", conteos y proformas.
  qc.invalidateQueries({ queryKey: queryKeys.facturacion.bandejaPrefix() });
  qc.invalidateQueries({ queryKey: queryKeys.facturacion.repPendientes });
  // Aging CxC y cartera: el CFDI cancelado o con NC ya no es cobrable igual.
  qc.invalidateQueries({ queryKey: queryKeys.cxc.all });
  qc.invalidateQueries({ queryKey: queryKeys.bandejas.all });
  invalidateProfitDependencies(qc);
  // La cabecera de una factura no enumera todos sus embarques. Refrescar esta
  // familia precisa incluye vínculos multiembarque, incluso sin detalle en cache.
  // No usar pnlFinanciero() como prefijo: su segundo segmento es undefined.
  const key = queryKeys.embarques.pnlFinanciero();
  await qc.invalidateQueries({ predicate: ({ queryKey }) =>
    queryKey.length === key.length && queryKey[0] === key[0] && typeof queryKey[1] === "string" && queryKey[2] === key[2],
  });
}
