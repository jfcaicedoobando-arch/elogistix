/**
 * Servicio CRM — Leads. Capa de I/O para `crm_leads` y conversión a oportunidad.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  LEAD_COLUMNS,
  type CrmLeadRow,
  type LeadFiltros,
  type LeadsResultado,
  type LeadInput,
} from "@/hooks/crm/leads/constants";
import { buildLeadInsertPayload, type AuthLite } from "@/hooks/crm/leads/leadPayload";

export async function listLeads(filtros: LeadFiltros): Promise<LeadsResultado> {
  const {
    search = "",
    estado = "todos",
    fuente = "todos",
    page = 0,
    pageSize = 25,
  } = filtros;

  let q = supabase
    .from("crm_leads")
    .select(LEAD_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false });

  if (search.trim()) {
    const term = `%${search.trim()}%`;
    q = q.or(`empresa.ilike.${term},contacto.ilike.${term},email.ilike.${term}`);
  }
  if (estado !== "todos") q = q.eq("estado", estado);
  if (fuente !== "todos") q = q.eq("fuente", fuente);

  const from = page * pageSize;
  q = q.range(from, from + pageSize - 1);

  const { data, count, error } = await q;
  if (error) throw error;
  return { data: (data ?? []) as CrmLeadRow[], count: count ?? 0 };
}

export async function getLead(id: string): Promise<CrmLeadRow | null> {
  const { data, error } = await supabase
    .from("crm_leads")
    .select(LEAD_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as CrmLeadRow | null;
}

export async function createLead(input: LeadInput, user: AuthLite | null): Promise<{ id: string }> {
  const payload = buildLeadInsertPayload(input, user);
  const { data, error } = await supabase
    .from("crm_leads")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return data;
}

export async function updateLead(id: string, patch: Partial<LeadInput>): Promise<void> {
  const { error } = await supabase.from("crm_leads").update(patch).eq("id", id);
  if (error) throw error;
}

export async function softDeleteLead(id: string, userId: string | null): Promise<void> {
  const { error } = await supabase
    .from("crm_leads")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id);
  if (error) throw error;
}

export async function bulkUpdateLeads(ids: string[], patch: Partial<LeadInput>): Promise<number> {
  if (ids.length === 0) return 0;
  const { error } = await supabase.from("crm_leads").update(patch).in("id", ids);
  if (error) throw error;
  return ids.length;
}

export async function bulkSoftDeleteLeads(ids: string[], userId: string | null): Promise<number> {
  if (ids.length === 0) return 0;
  const { error } = await supabase
    .from("crm_leads")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .in("id", ids);
  if (error) throw error;
  return ids.length;
}

export async function bulkCreateLeads(inputs: LeadInput[], user: AuthLite | null): Promise<number> {
  if (inputs.length === 0) return 0;
  const payloads = inputs.map((input) => buildLeadInsertPayload(input, user));
  let inserted = 0;
  for (let i = 0; i < payloads.length; i += 100) {
    const chunk = payloads.slice(i, i + 100);
    const { error, count } = await supabase
      .from("crm_leads")
      .insert(chunk, { count: "exact" });
    if (error) throw error;
    inserted += count ?? chunk.length;
  }
  return inserted;
}

// ---------- Conversión lead → cliente + oportunidad ----------

export interface ResolveClienteParams {
  lead: CrmLeadRow;
  crearCliente: boolean;
  clienteIdExistente?: string | null;
}

export async function resolveClienteForConversion(
  p: ResolveClienteParams,
): Promise<{ clienteId: string | null; clienteNombre: string }> {
  if (p.crearCliente && !p.clienteIdExistente) {
    const { data, error } = await supabase
      .from("clientes")
      .insert({
        nombre: p.lead.empresa,
        email: p.lead.email ?? "",
        telefono: p.lead.telefono ?? "",
        ciudad: p.lead.ciudad ?? "",
        contacto: p.lead.contacto ?? "",
      })
      .select("id, nombre")
      .single();
    if (error) throw error;
    return { clienteId: data.id, clienteNombre: data.nombre };
  }
  if (p.clienteIdExistente) {
    const { data } = await supabase
      .from("clientes")
      .select("nombre")
      .eq("id", p.clienteIdExistente)
      .maybeSingle();
    return { clienteId: p.clienteIdExistente, clienteNombre: data?.nombre ?? p.lead.empresa };
  }
  return { clienteId: null, clienteNombre: "" };
}

export async function fetchPrimeraEtapaAbierta(): Promise<{ id: string; probabilidad_default: number | null }> {
  const { data, error } = await supabase
    .from("crm_etapas_pipeline")
    .select("id, probabilidad_default")
    .eq("tipo", "abierta")
    .eq("activa", true)
    .order("orden", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("No hay etapas abiertas configuradas en el pipeline.");
  return data;
}

export interface ConvertirLeadParams {
  lead: CrmLeadRow;
  crearCliente: boolean;
  clienteIdExistente?: string | null;
  nombreOportunidad: string;
  montoEstimado: number;
  moneda: "MXN" | "USD" | "EUR";
  fechaEstimadaCierre?: string | null;
}

export async function convertirLead(
  params: ConvertirLeadParams,
  user: AuthLite | null,
): Promise<{ clienteId: string | null; oportunidadId: string }> {
  const { clienteId, clienteNombre } = await resolveClienteForConversion(params);
  const etapa = await fetchPrimeraEtapaAbierta();

  const { data: opNueva, error: errOp } = await supabase
    .from("crm_oportunidades")
    .insert({
      nombre: params.nombreOportunidad,
      lead_id: params.lead.id,
      cliente_id: clienteId,
      cliente_nombre: clienteNombre,
      etapa_id: etapa.id,
      probabilidad: etapa.probabilidad_default ?? 0,
      monto_estimado: params.montoEstimado,
      moneda: params.moneda,
      fecha_estimada_cierre: params.fechaEstimadaCierre ?? null,
      vendedor_id: params.lead.vendedor_id ?? user?.id ?? null,
      vendedor_email: params.lead.vendedor_email ?? user?.email ?? "",
      modo: params.lead.interes_modo ?? "",
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();
  if (errOp) throw errOp;

  const { error: errLead } = await supabase
    .from("crm_leads")
    .update({
      estado: "Convertido",
      cliente_convertido_id: clienteId,
      oportunidad_convertida_id: opNueva.id,
    })
    .eq("id", params.lead.id);
  if (errLead) throw errLead;

  return { clienteId, oportunidadId: opNueva.id };
}
