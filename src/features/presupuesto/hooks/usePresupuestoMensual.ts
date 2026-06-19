import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchPresupuestoMensualAnio, upsertCeldaPresupuesto,
  type UpsertCeldaParams,
} from "@/features/presupuesto/services";
import { notifyError } from "@/components/shared/utils/appFeedback";

export function usePresupuestoMensualAnio(anio: number) {
  return useQuery({
    queryKey: queryKeys.presupuesto.mensual(anio),
    queryFn: () => fetchPresupuestoMensualAnio(anio),
    staleTime: 30_000,
  });
}

// NOTA: la celda se guarda inline tras blur en la grilla; un toast por celda
// sería excesivo. Solo notificamos errores.
export function useUpsertCeldaPresupuesto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (p: UpsertCeldaParams) => upsertCeldaPresupuesto(p),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.presupuesto.all }),
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al guardar presupuesto: ${error.message}`, error, method: "UPSERT_PRESUPUESTO_CELDA" });
    },
  });
}
