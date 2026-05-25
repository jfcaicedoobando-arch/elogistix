import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { LeadInput } from "./constants";
import { buildLeadInsertPayload } from "./leadPayload";

export function useCrearLead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: LeadInput) => {
      const payload = buildLeadInsertPayload(input, user);
      const { data, error } = await supabase
        .from("crm_leads")
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "leads"] });
      qc.invalidateQueries({ queryKey: ["crm", "kpis"] });
      qc.invalidateQueries({ queryKey: ["crm", "dashboard"] });
    },
  });
}

export function useActualizarLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<LeadInput>;
    }) => {
      const { error } = await supabase
        .from("crm_leads")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["crm", "leads"] });
      qc.invalidateQueries({ queryKey: ["crm", "leads", "detail", vars.id] });
      qc.invalidateQueries({ queryKey: ["crm", "kpis"] });
    },
  });
}

export function useEliminarLead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("crm_leads")
        .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "leads"] });
      qc.invalidateQueries({ queryKey: ["crm", "kpis"] });
    },
  });
}
