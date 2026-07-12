/**
 * Cuenta de facturas de proveedor pendientes de aprobación para la organización
 * del usuario actual. Usado para el badge del sidebar en el módulo Compras.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchPendientesAprobacionCount } from "@/features/cxp/services";
import { queryKeys } from "@/lib/query";

export function useCxpPendientesAprobacion() {
  return useQuery({
    queryKey: queryKeys.cxp.pendientesAprobacionCount,
    queryFn: fetchPendientesAprobacionCount,
    staleTime: 60_000,
  });
}
