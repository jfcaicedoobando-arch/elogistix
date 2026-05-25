/**
 * Hooks de etapas del pipeline (CRM).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CrmEtapaRow = Database["public"]["Tables"]["crm_etapas_pipeline"]["Row"];
export type CrmEtapaTipo = Database["public"]["Enums"]["crm_etapa_tipo"];

const COLS =
  "id, nombre, orden, tipo, color, probabilidad_default, activa, organization_id, created_at, updated_at";

export function useEtapasPipeline() {
  return useQuery<CrmEtapaRow[]>({
    queryKey: ["crm", "etapas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_etapas_pipeline")
        .select(COLS)
        .eq("activa", true)
        .order("orden", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CrmEtapaRow[];
    },
  });
}

export function useActualizarEtapa() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      patch,
    }: {
      id: string;
      patch: Partial<Pick<CrmEtapaRow, "nombre" | "orden" | "tipo" | "color" | "probabilidad_default" | "activa">>;
    }) => {
      const { error } = await supabase.from("crm_etapas_pipeline").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "etapas"] }),
  });
}

export function useMotivosPerdida() {
  return useQuery({
    queryKey: ["crm", "motivos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_motivos_perdida")
        .select("id, nombre, activa")
        .eq("activa", true)
        .order("nombre");
      if (error) throw error;
      return data ?? [];
    },
  });
}
