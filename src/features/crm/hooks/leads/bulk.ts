import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { queryKeys } from "@/lib/query";
import { bulkUpdateLeads, bulkSoftDeleteLeads, bulkCreateLeads } from "@/features/crm/services/leads";
import type { LeadInput } from "./constants";

/** Actualiza un campo (estado o vendedor) sobre múltiples leads. */
export function useActualizarLeadsBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: Partial<LeadInput> }) => ({
      updated: await bulkUpdateLeads(ids, patch),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.leads.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.dashboardAll });
    },
  });
}

/** Soft-delete múltiples leads. */
export function useEliminarLeadsBulk() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (ids: string[]) => ({
      deleted: await bulkSoftDeleteLeads(ids, user?.id ?? null),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.leads.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.dashboardAll });
    },
  });
}

/** Inserta múltiples leads (CSV import). Devuelve count insertado. */
export function useCrearLeadsBulk() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (inputs: LeadInput[]) => ({
      inserted: await bulkCreateLeads(inputs, user),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.leads.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.dashboardAll });
    },
  });
}
