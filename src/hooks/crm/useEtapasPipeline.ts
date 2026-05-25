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

export function useMotivosPerdida(soloActivos = true) {
  return useQuery({
    queryKey: ["crm", "motivos", soloActivos],
    queryFn: async () => {
      let q = supabase.from("crm_motivos_perdida").select("id, nombre, activa").order("nombre");
      if (soloActivos) q = q.eq("activa", true);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Lista TODAS las etapas (activas e inactivas) para pantalla de configuración. */
export function useEtapasPipelineAll() {
  return useQuery<CrmEtapaRow[]>({
    queryKey: ["crm", "etapas", "all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_etapas_pipeline")
        .select(COLS)
        .order("orden", { ascending: true });
      if (error) throw error;
      return (data ?? []) as CrmEtapaRow[];
    },
  });
}

export function useActualizarMotivoPerdida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { nombre?: string; activa?: boolean } }) => {
      const { error } = await supabase.from("crm_motivos_perdida").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "motivos"] }),
  });
}

export function useCrearMotivoPerdida() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (nombre: string) => {
      const { error } = await supabase.from("crm_motivos_perdida").insert({ nombre, activa: true });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["crm", "motivos"] }),
  });
}

