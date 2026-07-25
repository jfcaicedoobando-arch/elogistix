import { useQuery } from "@tanstack/react-query";
import { anticiposProveedorKeys } from "../queryKeys";
import { fetchAplicacionesPorFactura } from "../services/anticiposProveedorService";

export function useAplicacionesPorFactura(facturaId?: string | null) {
  return useQuery({
    queryKey: anticiposProveedorKeys.aplicacionesPorFactura(facturaId),
    queryFn: () => fetchAplicacionesPorFactura(facturaId!),
    enabled: !!facturaId,
    staleTime: 30_000,
  });
}
