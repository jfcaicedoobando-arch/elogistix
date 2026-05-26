/**
 * useActualizarActividadNotas — mutación pequeña para editar el campo `resultado`
 * (notas) de una actividad CRM sin tocar el resto del registro.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { actualizarActividadNotas } from "@/services/crm";
import { queryKeys } from "@/lib/query";

export function useActualizarActividadNotas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: actualizarActividadNotas,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.actividades.all });
    },
  });
}
