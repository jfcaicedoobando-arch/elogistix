/**
 * Hook de las facturas de proveedor del embarque que pueden vincularse a un
 * documento del buzón CxP (v13.364.0).
 */
import { useQuery } from "@tanstack/react-query";
import { cxp } from "@/features/cxp/queryKeys";
import { listarFacturasVinculablesEntrante } from "@/features/cxp/services/facturasVinculablesEntrante";

export function useFacturasVinculablesEntrante(embarqueId: string | null, enabled = true) {
  return useQuery({
    queryKey: cxp.facturasVinculablesEntrante(embarqueId),
    queryFn: () => listarFacturasVinculablesEntrante(embarqueId as string),
    enabled: Boolean(embarqueId) && enabled,
  });
}
