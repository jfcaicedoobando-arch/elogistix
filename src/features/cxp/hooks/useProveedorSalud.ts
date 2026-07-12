import { useQuery } from "@tanstack/react-query";
import { fetchProveedorSalud } from "@/features/cxp/services/proveedorSalud";
import { queryKeys } from "@/lib/query";

export function useProveedorSalud(proveedorId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.proveedorSalud.byId(proveedorId),
    queryFn: () => fetchProveedorSalud(proveedorId as string),
    enabled: !!proveedorId,
    staleTime: 60_000,
  });
}
