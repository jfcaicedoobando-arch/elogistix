import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/query";
import { convertirLead, type ConvertirLeadParams } from "@/services/crm/leads";

/**
 * Convierte un lead en (opcional) cliente y oportunidad nueva.
 * Toda la I/O vive en `services/crm/leads`.
 */
export function useConvertirLead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (params: ConvertirLeadParams) => convertirLead(params, user),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.leads.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.kpis });
      qc.invalidateQueries({ queryKey: queryKeys.clientes.all });
    },
  });
}
