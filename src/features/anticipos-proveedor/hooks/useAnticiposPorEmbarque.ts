/** Anticipos ligados a un embarque (pestaña Costos del detalle de embarque). */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { anticiposProveedorKeys } from "@/features/anticipos-proveedor/queryKeys";
import { fetchAnticiposPorEmbarque } from "@/features/anticipos-proveedor/services/anticiposProveedorService";

export function useAnticiposPorEmbarque(embarqueId?: string | null) {
  const q = useQuery({
    queryKey: anticiposProveedorKeys.porEmbarque(embarqueId),
    queryFn: () => fetchAnticiposPorEmbarque(embarqueId!),
    enabled: !!embarqueId,
    staleTime: 30_000,
  });
  const data = useMemo(() => q.data ?? [], [q.data]);
  return { ...q, data };
}
