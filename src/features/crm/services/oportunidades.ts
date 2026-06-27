/**
 * Servicio CRM — Oportunidades. Capa de I/O para `crm_oportunidades`.
 */
import { supabase } from "@/integrations/supabase/client";
import { buildOportunidadInsertPayload } from "@/features/crm/domain/oportunidadPayload";
export type { CrmOportunidadRow, Moneda, OportunidadInput } from "@/features/crm/types/oportunidades";
import type { CrmOportunidadRow, OportunidadInput } from "@/features/crm/types/oportunidades";

const COLS =
  "id, nombre, cliente_id, cliente_nombre, lead_id, vendedor_id, vendedor_email, etapa_id, monto_estimado, valor_real, moneda, probabilidad, fecha_estimada_cierre, fecha_cierre_real, motivo_perdida_id, modo, tipo_carga, origen, destino, notas, cotizacion_ganadora_id, embarque_ganador_id, created_at, updated_at";

export interface ListOportunidadesParams {
  search: string;
  etapaId: string | "todas";
  vendedorId: string | "todos";
  page: number;
  pageSize: number;
}

export async function listOportunidades(p: ListOportunidadesParams): Promise<{ data: CrmOportunidadRow[]; count: number }> {
  let q = supabase
    .from("crm_oportunidades")
    .select(COLS, { count: "exact" })
    .order("created_at", { ascending: false });
  if (p.search.trim()) {
    const t = `%${p.search.trim()}%`;
    q = q.or(`nombre.ilike.${t},cliente_nombre.ilike.${t}`);
  }
  if (p.etapaId !== "todas") q = q.eq("etapa_id", p.etapaId);
  if (p.vendedorId !== "todos") q = q.eq("vendedor_id", p.vendedorId);
  const from = p.page * p.pageSize;
  q = q.range(from, from + p.pageSize - 1);
  const { data, count, error } = await q;
  if (error) throw error;
  return { data: (data ?? []) as CrmOportunidadRow[], count: count ?? 0 };
}

export async function getOportunidad(id: string): Promise<CrmOportunidadRow | null> {
  const { data, error } = await supabase
    .from("crm_oportunidades")
    .select(COLS)
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as CrmOportunidadRow | null;
}


export async function crearOportunidad(
  input: OportunidadInput,
  user: { id?: string; email?: string } | null,
): Promise<{ id: string }> {
  const payload = buildOportunidadInsertPayload(input, user);
  const { data, error } = await supabase
    .from("crm_oportunidades")
    .insert(payload)
    .select("id")
    .single();
  if (error) throw error;
  return data as { id: string };
}

export async function actualizarOportunidad(input: {
  id: string;
  patch: Partial<OportunidadInput & { motivo_perdida_id?: string | null; fecha_cierre_real?: string | null }>;
}): Promise<void> {
  const { error } = await supabase
    .from("crm_oportunidades")
    .update(input.patch)
    .eq("id", input.id);
  if (error) throw error;
}

export async function moverEtapaOportunidad(input: {
  id: string;
  etapa_id: string;
  probabilidad?: number;
}): Promise<void> {
  const patch: { etapa_id: string; probabilidad?: number } = { etapa_id: input.etapa_id };
  if (typeof input.probabilidad === "number") patch.probabilidad = input.probabilidad;
  const { error } = await supabase
    .from("crm_oportunidades")
    .update(patch)
    .eq("id", input.id);
  if (error) throw error;
}

export async function eliminarOportunidad(id: string, userId: string | null): Promise<void> {
  const { error } = await supabase
    .from("crm_oportunidades")
    .update({ deleted_at: new Date().toISOString(), deleted_by: userId })
    .eq("id", id);
  if (error) throw error;
}
