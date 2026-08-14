/** Monto de cada anticipo ya aplicado a facturas del mismo embarque. */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { anticiposProveedorKeys } from "@/features/anticipos-proveedor/queryKeys";
import { fetchAplicadoEnEmbarque } from "@/features/anticipos-proveedor/services/anticiposProveedorService";

export function useAplicadoEnEmbarque(embarqueId?: string | null) {
  const q = useQuery({
    queryKey: anticiposProveedorKeys.aplicadoEnEmbarque(embarqueId),
    queryFn: () => fetchAplicadoEnEmbarque(embarqueId as string),
    enabled: Boolean(embarqueId),
    staleTime: 30_000,
  });
  const data = useMemo(() => q.data ?? {}, [q.data]);
  return { ...q, data };
}
