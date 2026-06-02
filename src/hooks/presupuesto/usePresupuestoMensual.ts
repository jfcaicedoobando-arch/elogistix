import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchPresupuestoMensualAnio, upsertCeldaPresupuesto,
  type UpsertCeldaParams,
} from "@/services/presupuesto/mensual";

export function usePresupuestoMensualAnio(anio: number) {
  return useQuery({
    queryKey: queryKeys.presupuesto.mensual(anio),
    queryFn: () => fetchPresupuestoMensualAnio(anio),
    staleTime: 30_000,
  });
}

export function useUpsertCeldaPresupuesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: UpsertCeldaParams) => upsertCeldaPresupuesto(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.presupuesto.all }),
  });
}
