/**
 * Ola 2 — Estado de cuenta cronológico del proveedor (cargos, abonos, aging).
 */
import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchProveedorMovimientos } from "@/features/proveedor/services/estadoCuentaMovimientos";

export function useProveedorMovimientos(
  proveedorId: string | undefined,
  desde?: string,
  hasta?: string,
) {
  return useQuery({
    queryKey: [...queryKeys.proveedores.movimientos(proveedorId ?? ""), desde ?? "", hasta ?? ""],
    queryFn: () => fetchProveedorMovimientos(proveedorId!, desde, hasta),
    enabled: Boolean(proveedorId),
    staleTime: 30_000,
  });
}
