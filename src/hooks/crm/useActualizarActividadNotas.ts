/**
 * useActualizarActividadNotas — mutación pequeña para editar el campo `resultado`
 * (notas) de una actividad CRM sin tocar el resto del registro.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { queryKeys } from "@/lib/query";

export function useActualizarActividadNotas() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, resultado }: { id: string; resultado: string }) => {
      const { error } = await supabase
        .from("crm_actividades")
        .update({ resultado })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.actividades.all });
    },
  });
}
