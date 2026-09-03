import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { queryKeys } from "@/lib/query";
import { bulkUpdateLeads, bulkSoftDeleteLeads, bulkCreateLeads } from "@/features/crm/services/leads";
import type { ResultadoLote } from "@/features/crm/services/leads/bulk";
import type { LeadInput } from "./constants";

/**
 * Los hooks bulk SÓLO invalidan caché y devuelven el resultado: el feedback
 * (un único toast, con aviso secundario de bitácora si existió) lo emite el
 * call-site — antes salían dos toasts por operación.
 */
function useInvalidarLeads() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: queryKeys.crm.leads.all });
    qc.invalidateQueries({ queryKey: queryKeys.crm.dashboardAll });
  };
}

/** Actualiza un campo (estado o vendedor) sobre múltiples leads. */
export function useActualizarLeadsBulk() {
  const invalidar = useInvalidarLeads();
  return useMutation<ResultadoLote, Error, { ids: string[]; patch: Partial<LeadInput> }>({
    mutationFn: ({ ids, patch }) => bulkUpdateLeads(ids, patch),
    onSuccess: invalidar,
  });
}

/** Soft-delete múltiples leads. */
export function useEliminarLeadsBulk() {
  const invalidar = useInvalidarLeads();
  const { user } = useAuth();
  return useMutation<ResultadoLote, Error, string[]>({
    mutationFn: (ids) => bulkSoftDeleteLeads(ids, user?.id ?? null),
    onSuccess: invalidar,
  });
}

/** Inserta múltiples leads (CSV import). Devuelve las filas realmente creadas. */
export function useCrearLeadsBulk() {
  const invalidar = useInvalidarLeads();
  const { user } = useAuth();
  return useMutation<ResultadoLote, Error, LeadInput[]>({
    mutationFn: (inputs) => bulkCreateLeads(inputs, user),
    onSuccess: invalidar,
  });
}
