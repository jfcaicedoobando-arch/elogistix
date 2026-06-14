import { useQuery } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import { fetchPresupuestoVsReal } from "@/features/presupuesto/services";

export function usePresupuestoVsReal(periodo: string) {
  return useQuery({
    queryKey: queryKeys.presupuesto.vsReal(periodo),
    queryFn: () => fetchPresupuestoVsReal(periodo),
    staleTime: 30_000,
    enabled: !!periodo,
  });
}
