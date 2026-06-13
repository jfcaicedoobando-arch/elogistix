/**
 * Servicio CRM — Etapas del pipeline y motivos de pérdida.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type CrmEtapaRow = Database["public"]["Tables"]["crm_etapas_pipeline"]["Row"];
export type CrmEtapaTipo = Database["public"]["Enums"]["crm_etapa_tipo"];

const COLS =
  "id, nombre, orden, tipo, color, probabilidad_default, activa, crea_tarea_seguimiento, dias_seguimiento, organization_id, created_at, updated_at";

export async function fetchEtapasPipelineActivas(): Promise<CrmEtapaRow[]> {
  const { data, error } = await supabase
    .from("crm_etapas_pipeline")
    .select(COLS)
    .eq("activa", true)
    .order("orden", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CrmEtapaRow[];
}

export async function fetchEtapasPipelineTodas(): Promise<CrmEtapaRow[]> {
  const { data, error } = await supabase
    .from("crm_etapas_pipeline")
    .select(COLS)
    .order("orden", { ascending: true });
  if (error) throw error;
  return (data ?? []) as CrmEtapaRow[];
}

export type EtapaPatch = Partial<
  Pick<
    CrmEtapaRow,
    | "nombre"
    | "orden"
    | "tipo"
    | "color"
    | "probabilidad_default"
    | "activa"
    | "crea_tarea_seguimiento"
    | "dias_seguimiento"
  >
>;

export async function actualizarEtapa(input: { id: string; patch: EtapaPatch }): Promise<void> {
  const { error } = await supabase
    .from("crm_etapas_pipeline")
    .update(input.patch)
    .eq("id", input.id);
  if (error) throw error;
}

export interface MotivoPerdidaRow {
  id: string;
  nombre: string;
  activa: boolean;
}

export async function fetchMotivosPerdida(soloActivos = true): Promise<MotivoPerdidaRow[]> {
  let q = supabase.from("crm_motivos_perdida").select("id, nombre, activa").order("nombre");
  if (soloActivos) q = q.eq("activa", true);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as MotivoPerdidaRow[];
}

export async function actualizarMotivoPerdida(input: {
  id: string;
  patch: { nombre?: string; activa?: boolean };
}): Promise<void> {
  const { error } = await supabase
    .from("crm_motivos_perdida")
    .update(input.patch)
    .eq("id", input.id);
  if (error) throw error;
}

export async function crearMotivoPerdida(nombre: string): Promise<void> {
  const { error } = await supabase
    .from("crm_motivos_perdida")
    .insert({ nombre, activa: true });
  if (error) throw error;
}
