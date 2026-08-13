/**
 * Estado de cuenta conciliado del proveedor: comprometido → facturado → pagado.
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchProveedorEstadoCuenta } from "@/features/proveedor/services/estadoCuenta";

export function useProveedorEstadoCuenta(proveedorId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.proveedores.estadoCuenta(proveedorId ?? ""),
    queryFn: () => fetchProveedorEstadoCuenta(proveedorId!),
    enabled: Boolean(proveedorId),
    staleTime: 30_000,
  });
}
