import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { queryKeys } from "@/lib/query";
import { convertirLead, type ConvertirLeadParams } from "@/features/crm/services/leads";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import { getErrorMessage } from "@/lib/errors";

/**
 * Convierte un lead en (opcional) cliente y oportunidad nueva.
 * Toda la I/O vive en `services/crm/leads`.
 */
/** `silencioso`: el call-site emite su propio aviso accionable (un solo toast). */
type ConvertirLeadVars = ConvertirLeadParams & { silencioso?: boolean };

export function useConvertirLead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: ({ silencioso: _s, ...params }: ConvertirLeadVars) => convertirLead(params, user),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.leads.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.prospectos.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.kpis });
      qc.invalidateQueries({ queryKey: queryKeys.clientes.all });
      // La conversión crea una oportunidad nueva: sin invalidar el árbol de
      // oportunidades, el kanban no la muestra hasta que vence el staleTime
      // (refetchOnWindowFocus está desactivado). El dashboard/Mi-día
      // (crm.dashboard) también cambia (kpis, leads sin contactar, deals).
      qc.invalidateQueries({ queryKey: queryKeys.crm.oportunidades.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.dashboardAll });

      if (!variables.silencioso) notifySuccess(undefined, { title: "Lead convertido en oportunidad" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "No se pudo convertir lead", description: getErrorMessage(error), error, method: "CONVERT_LEAD" });
    },
  });
}
