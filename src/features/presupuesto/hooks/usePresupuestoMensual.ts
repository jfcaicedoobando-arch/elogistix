import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/query";
import {
  fetchPresupuestoMensualAnio, upsertCeldaPresupuesto,
  type UpsertCeldaParams,
} from "@/features/presupuesto/services";
import { useOrganization } from "@/lib/contexts/OrganizationContext";
import { notifyError } from "@/components/shared/utils/appFeedback";

export function usePresupuestoMensualAnio(anio: number) {
  const { organizationId } = useOrganization();
  return useQuery({
    queryKey: queryKeys.presupuesto.mensualPorOrg(anio, organizationId),
    queryFn: () => fetchPresupuestoMensualAnio(anio, organizationId),
    staleTime: 30_000,
    enabled: !!organizationId,
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
