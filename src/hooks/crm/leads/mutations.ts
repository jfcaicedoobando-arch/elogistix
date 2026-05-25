import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { LeadInput } from "./constants";

export function useCrearLead() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (input: LeadInput) => {
      const payload = {
        empresa: input.empresa,
        contacto: input.contacto ?? "",
        email: input.email ?? "",
        telefono: input.telefono ?? "",
        ciudad: input.ciudad ?? "",
        pais: input.pais ?? "",
        fuente: input.fuente ?? "Otro",
        estado: input.estado ?? "Nuevo",
        score: input.score ?? 3,
        interes_modo: input.interes_modo ?? "",
        notas: input.notas ?? "",
        vendedor_id:
          input.vendedor_id !== undefined ? input.vendedor_id : (user?.id ?? null),
        vendedor_email: input.vendedor_email ?? user?.email ?? "",
        created_by: user?.id ?? null,
      };
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
