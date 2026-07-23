import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { queryKeys } from "@/lib/query";
import { bulkUpdateLeads, bulkSoftDeleteLeads, bulkCreateLeads } from "@/features/crm/services/leads";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import type { LeadInput } from "./constants";

/** Actualiza un campo (estado o vendedor) sobre múltiples leads. */
export function useActualizarLeadsBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: Partial<LeadInput> }) => ({
      updated: await bulkUpdateLeads(ids, patch),
    }),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.leads.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.dashboardAll });
      notifySuccess(undefined, { title: `${data.updated} leads actualizados` });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al actualizar leads: ${error.message}`, error, method: "BULK_UPDATE_LEADS" });
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
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.leads.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.dashboardAll });
      notifySuccess(undefined, { title: `${data.deleted} leads eliminados` });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al eliminar leads: ${error.message}`, error, method: "BULK_DELETE_LEADS" });
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
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.leads.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.dashboardAll });
      notifySuccess(undefined, { title: `${data.inserted} leads importados` });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: `Error al importar leads: ${error.message}`, error, method: "BULK_CREATE_LEADS" });
    },
  });
}
