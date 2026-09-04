import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/lib/contexts/AuthContext";
import { queryKeys } from "@/lib/query";
import { createLead, updateLead, softDeleteLead, tomarLead } from "@/features/crm/services/leads";
import { calificarProspecto, mensajeErrorCalificar } from "@/features/crm/services/leads";
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
      qc.invalidateQueries({ queryKey: queryKeys.crm.dashboardAll });
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
      qc.invalidateQueries({ queryKey: queryKeys.crm.dashboardAll });
      notifySuccess(undefined, { title: "Lead eliminado" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "No se pudo eliminar lead", description: getErrorMessage(error), error, method: "DELETE_LEAD" });
    },
  });
}

/** Ola 6 · O6.1 — toma un lead sin asignar de la bolsa común (CRM Fase 1). */
export function useTomarLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, empresa }: { id: string; empresa: string }) => tomarLead(id, empresa),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.leads.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.leads.detail(vars.id) });
      qc.invalidateQueries({ queryKey: queryKeys.crm.kpis });
      qc.invalidateQueries({ queryKey: queryKeys.crm.dashboardAll });
      notifySuccess(undefined, { title: "Lead asignado a tu cartera" });
    },
    onError: (error: Error) => {
      notifyError(undefined, { title: "No se pudo tomar el lead", description: getErrorMessage(error), error, method: "TOMAR_LEAD" });
    },
  });
}

/**
 * Rediseño CRM (v13.766.0) — gate Lead → Prospecto.
 * La validación (perfil comercial completo, rol de ventas, misma organización)
 * vive en la RPC `crm_calificar_prospecto`.
 */
export function useCalificarProspecto() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => calificarProspecto(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: queryKeys.crm.leads.all });
      qc.invalidateQueries({ queryKey: queryKeys.crm.leads.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.crm.kpis });
      qc.invalidateQueries({ queryKey: queryKeys.crm.dashboardAll });
      notifySuccess(undefined, { title: "Lead calificado como prospecto" });
    },
    onError: (error: Error) => {
      notifyError(undefined, {
        title: "No se pudo calificar el lead",
        description: mensajeErrorCalificar(error),
        error,
        method: "CALIFICAR_PROSPECTO",
      });
    },
  });
}
