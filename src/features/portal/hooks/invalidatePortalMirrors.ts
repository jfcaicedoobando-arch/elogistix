/**
 * A5 — Invalidación del namespace espejo `['portal', …]` desde mutaciones
 * internas. Toda mutación que toque una entidad expuesta al portal cliente
 * debe llamar a este helper (patrón análogo a `invalidateProfitDependencies`).
 */
import type { QueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";

export interface PortalMirrorIds {
  cotizacionId?: string;
  facturaId?: string;
  embarqueId?: string;
}

export function invalidatePortalMirrors(qc: QueryClient, ids: PortalMirrorIds): void {
  if (ids.cotizacionId) {
    qc.invalidateQueries({ queryKey: queryKeys.portal.cotizacion(ids.cotizacionId) });
    qc.invalidateQueries({ queryKey: queryKeys.portal.cotizacionesAll });
  }
  if (ids.facturaId) {
    qc.invalidateQueries({ queryKey: queryKeys.portal.factura(ids.facturaId) });
    qc.invalidateQueries({ queryKey: queryKeys.portal.facturasAll });
    qc.invalidateQueries({ queryKey: queryKeys.portal.pagosFactura(ids.facturaId) });
  }
  if (ids.embarqueId) {
    qc.invalidateQueries({ queryKey: queryKeys.portal.embarque(ids.embarqueId) });
    qc.invalidateQueries({ queryKey: queryKeys.portal.embarquesAll });
  }
}
