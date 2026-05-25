import { supabase } from "@/integrations/supabase/client";

export interface LeadOportunidadRow {
  id: string;
  nombre: string;
  monto_estimado: number | null;
  moneda: string;
  probabilidad: number | null;
  fecha_estimada_cierre: string | null;
}

export interface LineageCotRow {
  id: string;
  folio: string;
  estado: string;
  modo: string;
  embarque_id: string | null;
  created_at: string;
}

export interface LineageEmbRow {
  id: string;
  expediente: string;
  estado: string;
  modo: string;
}

export interface LineageLead {
  id: string;
  empresa: string;
  estado: string;
}

export async function fetchLeadLineage(leadId: string): Promise<LeadOportunidadRow[]> {
  const { data, error } = await supabase
    .from("crm_oportunidades")
    .select("id, nombre, monto_estimado, moneda, probabilidad, fecha_estimada_cierre")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LeadOportunidadRow[];
}

export async function fetchOportunidadCotsLineage(
  oportunidadId: string,
): Promise<LineageCotRow[]> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("id, folio, estado, modo, embarque_id, created_at")
    .eq("oportunidad_id", oportunidadId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as LineageCotRow[];
}

export async function fetchEmbarquesByIds(ids: string[]): Promise<LineageEmbRow[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from("embarques")
    .select("id, expediente, estado, modo")
    .in("id", ids)
    .is("deleted_at", null);
  if (error) throw error;
  return (data ?? []) as LineageEmbRow[];
}

export async function fetchLeadResumen(leadId: string): Promise<LineageLead | null> {
  const { data, error } = await supabase
    .from("crm_leads")
    .select("id, empresa, estado")
    .eq("id", leadId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as LineageLead | null;
}
