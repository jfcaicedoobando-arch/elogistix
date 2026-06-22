import { useQuery } from "@tanstack/react-query";
import { fetchProveedorSalud } from "@/features/cxp/services/proveedorSalud";

export function useProveedorSalud(proveedorId: string | undefined) {
  return useQuery({
    queryKey: ["proveedor", "salud", proveedorId] as const,
    queryFn: () => fetchProveedorSalud(proveedorId as string),
    enabled: !!proveedorId,
    staleTime: 60_000,
  });
}
