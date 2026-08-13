/**
 * Ola 2 — Estado de cuenta cronológico del proveedor (cargos, abonos, aging).
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchProveedorMovimientos } from "@/features/proveedor/services/estadoCuentaMovimientos";

export function useProveedorMovimientos(proveedorId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.proveedores.movimientos(proveedorId ?? ""),
    queryFn: () => fetchProveedorMovimientos(proveedorId!),
    enabled: Boolean(proveedorId),
    staleTime: 30_000,
  });
}
