import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { LeadInput } from "./constants";
import { buildLeadInsertPayload } from "./leadPayload";

/** Actualiza un campo (estado o vendedor) sobre múltiples leads. */
export function useActualizarLeadsBulk() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: Partial<LeadInput> }) => {
      if (ids.length === 0) return { updated: 0 };
      const { error } = await supabase.from("crm_leads").update(patch).in("id", ids);
      if (error) throw error;
      return { updated: ids.length };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "leads"] });
      qc.invalidateQueries({ queryKey: ["crm", "dashboard"] });
    },
  });
}

/** Soft-delete múltiples leads. */
export function useEliminarLeadsBulk() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return { deleted: 0 };
      const { error } = await supabase
        .from("crm_leads")
        .update({ deleted_at: new Date().toISOString(), deleted_by: user?.id ?? null })
        .in("id", ids);
      if (error) throw error;
      return { deleted: ids.length };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "leads"] });
      qc.invalidateQueries({ queryKey: ["crm", "dashboard"] });
    },
  });
}

/** Inserta múltiples leads (CSV import). Devuelve count insertado. */
export function useCrearLeadsBulk() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async (inputs: LeadInput[]) => {
      if (inputs.length === 0) return { inserted: 0 };
      const payloads = inputs.map((input) => buildLeadInsertPayload(input, user));
      // batch de 100
      let inserted = 0;
      for (let i = 0; i < payloads.length; i += 100) {
        const chunk = payloads.slice(i, i + 100);
        const { error, count } = await supabase
          .from("crm_leads")
          .insert(chunk, { count: "exact" });
        if (error) throw error;
        inserted += count ?? chunk.length;
      }
      return { inserted };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["crm", "leads"] });
      qc.invalidateQueries({ queryKey: ["crm", "dashboard"] });
    },
  });
}
