/**
 * Inteligencia del proveedor (Ola 4): scorecard, tendencia, comparativo y alertas.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchProveedorInteligencia } from "@/features/proveedor/services/proveedorInteligencia";
import { proveedores } from "@/features/proveedor/queryKeys";

export function useProveedorInteligencia(proveedorId: string | undefined) {
  return useQuery({
    queryKey: proveedores.inteligencia(proveedorId ?? ""),
    queryFn: () => fetchProveedorInteligencia(proveedorId as string),
    enabled: !!proveedorId,
    staleTime: 60_000,
  });
}
