import { supabase } from "@/integrations/supabase/client";
import { unwrap, unwrapOr } from "@/lib/supabase/response";

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
  const data = await unwrapOr(
    supabase
      .from("crm_oportunidades")
      .select("id, nombre, monto_estimado, moneda, probabilidad, fecha_estimada_cierre")
      .eq("lead_id", leadId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    [],
  );
  // SAFE-CAST: el select explícito coincide 1:1 con LeadOportunidadRow.
  return data as unknown as LeadOportunidadRow[];
}

export async function fetchOportunidadCotsLineage(
  oportunidadId: string,
): Promise<LineageCotRow[]> {
  const data = await unwrapOr(
    supabase
      .from("cotizaciones")
      .select("id, folio, estado, modo, embarque_id, created_at")
      .eq("oportunidad_id", oportunidadId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false }),
    [],
  );
  // SAFE-CAST: el select explícito coincide 1:1 con LineageCotRow.
  return data as unknown as LineageCotRow[];
}

export async function fetchEmbarquesByIds(ids: string[]): Promise<LineageEmbRow[]> {
  if (ids.length === 0) return [];
  const data = await unwrapOr(
    supabase
      .from("embarques")
      .select("id, expediente, estado, modo")
      .in("id", ids)
      .is("deleted_at", null),
    [],
  );
  // SAFE-CAST: el select explícito coincide 1:1 con LineageEmbRow.
  return data as unknown as LineageEmbRow[];
}

export async function fetchLeadResumen(leadId: string): Promise<LineageLead | null> {
  const data = await unwrap(
    supabase
      .from("crm_leads")
      .select("id, empresa, estado")
      .eq("id", leadId)
      .maybeSingle(),
  );
  return (data ?? null) as LineageLead | null;
}
