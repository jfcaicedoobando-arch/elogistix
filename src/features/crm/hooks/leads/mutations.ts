import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { queryKeys } from "@/lib/query";
import { createLead, updateLead, softDeleteLead } from "@/features/crm/services/leads";
import { notifyError, notifySuccess } from "@/lib/ui/appFeedback";
import type { LeadInput } from "./constants";
import { getErrorMessage } from "@/lib/errors";

export function useCrearLead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (input: LeadInput) => createLead(input, user),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.leads.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.kpis });
      qc.invalidateQueries({ queryKey: queryKeys.crm.dashboardAll });
      notifySuccess(undefined, { title: "Lead creado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "No se pudo crear lead", description: getErrorMessage(error), error, method: "CREATE_LEAD" });
    },
  });
}

export function useActualizarLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<LeadInput> }) => updateLead(id, patch),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.leads.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.leads.detail(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.crm.kpis });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "No se pudo actualizar lead", description: getErrorMessage(error), error, method: "UPDATE_LEAD" });
    },
  });
}

export function useEliminarLead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: (id: string) => softDeleteLead(id, user?.id ?? null),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.leads.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.kpis });
      notifySuccess(undefined, { title: "Lead eliminado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "No se pudo eliminar lead", description: getErrorMessage(error), error, method: "DELETE_LEAD" });
    },
  });
}
