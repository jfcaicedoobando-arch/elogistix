/**
 * Servicio CRM: encapsula I/O de Supabase para el módulo CRM (oportunidades,
 * lineage, leaderboard, creación de cotizaciones desde oportunidad).
 * Los componentes y páginas NO deben llamar a supabase directamente.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type CotizacionInsert = Database["public"]["Tables"]["cotizaciones"]["Insert"];

export interface OportunidadCotizacionRow {
  id: string;
  folio: string;
  estado: string;
  subtotal: number;
  moneda: string;
  created_at: string;
  embarque_id: string | null;
}

export async function fetchOportunidadCotizaciones(
  oportunidadId: string,
): Promise<OportunidadCotizacionRow[]> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("id, folio, estado, subtotal, moneda, created_at, embarque_id")
    .eq("oportunidad_id", oportunidadId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OportunidadCotizacionRow[];
}

export interface LeadOportunidadRow {
  id: string;
  nombre: string;
  monto_estimado: number | null;
  moneda: string;
  probabilidad: number | null;
  fecha_estimada_cierre: string | null;
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

// =================== Leaderboard ===================

export interface LeaderboardRow {
  vendedor: string;
  cuota: number;
  cerrado: number;
  avance: number;
}

export interface LeaderboardRawData {
  cuotas: Array<{ vendedor_email: string | null; cuota_monto: number | null }>;
  ops: Array<{
    vendedor_email: string | null;
    valor_real: number | null;
    monto_estimado: number | null;
    etapa_id: string;
  }>;
  etapas: Array<{ id: string; tipo: string }>;
}

export async function fetchLeaderboardRaw(
  anio: number,
  mes: number,
  inicioMesISO: string,
): Promise<LeaderboardRawData> {
  const [cuotasR, opsR, etapasR] = await Promise.all([
    supabase
      .from("crm_cuotas_vendedor")
      .select("vendedor_email, cuota_monto, anio, mes")
      .eq("anio", anio)
      .eq("mes", mes),
    supabase
      .from("crm_oportunidades")
      .select("vendedor_email, valor_real, monto_estimado, etapa_id, fecha_cierre_real")
      .gte("fecha_cierre_real", inicioMesISO),
    supabase.from("crm_etapas_pipeline").select("id, tipo"),
  ]);
  if (cuotasR.error) throw cuotasR.error;
  if (opsR.error) throw opsR.error;
  if (etapasR.error) throw etapasR.error;
  return {
    cuotas: (cuotasR.data ?? []) as LeaderboardRawData["cuotas"],
    ops: (opsR.data ?? []) as LeaderboardRawData["ops"],
    etapas: (etapasR.data ?? []) as LeaderboardRawData["etapas"],
  };
}

/** Lógica pura, testeable: agrega cuotas/ops por vendedor y calcula avance. */
export function computeLeaderboard(raw: LeaderboardRawData): LeaderboardRow[] {
  const tipoEtapa = new Map(raw.etapas.map((e) => [e.id, e.tipo]));
  const cerradoMap = new Map<string, number>();
  for (const o of raw.ops) {
    if (tipoEtapa.get(o.etapa_id) !== "ganada") continue;
    const k = o.vendedor_email || "Sin asignar";
    const monto = Number(o.valor_real ?? o.monto_estimado ?? 0);
    cerradoMap.set(k, (cerradoMap.get(k) ?? 0) + monto);
  }
  const cuotaMap = new Map<string, number>();
  for (const c of raw.cuotas) {
    cuotaMap.set(c.vendedor_email || "Sin asignar", Number(c.cuota_monto ?? 0));
  }
  const todos = new Set<string>([...cerradoMap.keys(), ...cuotaMap.keys()]);
  const filas: LeaderboardRow[] = Array.from(todos).map((vendedor) => {
    const cuota = cuotaMap.get(vendedor) ?? 0;
    const cerrado = cerradoMap.get(vendedor) ?? 0;
    const avance = cuota > 0 ? Math.min(100, Math.round((cerrado / cuota) * 100)) : 0;
    return { vendedor, cuota, cerrado, avance };
  });
  return filas.sort((a, b) => b.cerrado - a.cerrado);
}

// =================== Cotización desde Oportunidad ===================

export interface CrearCotizacionDesdeOpInput {
  folio: string;
  modo: "Marítimo" | "Aéreo" | "Terrestre" | "Multimodal";
  oportunidad: {
    id: string;
    cliente_id: string | null;
    cliente_nombre: string | null;
    origen: string | null;
    destino: string | null;
  };
  operador: string;
}

export async function insertCotizacionDesdeOportunidad(
  input: CrearCotizacionDesdeOpInput,
): Promise<{ id: string }> {
  const payload: CotizacionInsert = {
    folio: input.folio,
    modo: input.modo,
    tipo: "Importación",
    cliente_id: input.oportunidad.cliente_id,
    cliente_nombre: input.oportunidad.cliente_nombre ?? "",
    origen: input.oportunidad.origen ?? "",
    destino: input.oportunidad.destino ?? "",
    oportunidad_id: input.oportunidad.id,
    operador: input.operador,
    es_prospecto: !input.oportunidad.cliente_id,
  };
  const { data, error } = await supabase
    .from("cotizaciones")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return { id: data.id };
}

export async function actualizarEtapaOportunidad(
  oportunidadId: string,
  etapaId: string,
  probabilidad: number,
): Promise<void> {
  const { error } = await supabase
    .from("crm_oportunidades")
    .update({ etapa_id: etapaId, probabilidad })
    .eq("id", oportunidadId);
  if (error) throw error;
}
