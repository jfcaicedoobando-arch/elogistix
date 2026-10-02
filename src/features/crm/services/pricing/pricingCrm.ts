/**
 * Lecturas y escrituras de la Solicitud a Pricing (CRM Fase 5).
 * Estado y reloj sólo cambian por RPC (la base lo impone con trigger).
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  OpcionPricingForm, OpcionPricingRow, SolicitudPricingInsert, SolicitudPricingRow,
} from "./tiposPricing";

export const PAGINA_PRICING = 25;
const COLS_SOL = "*";

export async function listarSolicitudesOportunidad(oportunidadId: string): Promise<SolicitudPricingRow[]> {
  const { data, error } = await supabase
    .from("crm_solicitudes_pricing").select(COLS_SOL)
    .eq("oportunidad_id", oportunidadId).is("deleted_at", null)
    .order("created_at", { ascending: false }).limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function listarBandejaPricing(
  estado: string, pagina: number,
): Promise<{ filas: SolicitudPricingRow[]; total: number }> {
  const desde = pagina * PAGINA_PRICING;
  let q = supabase.from("crm_solicitudes_pricing").select(COLS_SOL, { count: "exact" }).is("deleted_at", null);
  q = estado === "todos" ? q.neq("estado", "borrador") : q.eq("estado", estado);
  const { data, error, count } = await q
    .order("vence_at", { ascending: true, nullsFirst: false })
    .range(desde, desde + PAGINA_PRICING - 1);
  if (error) throw error;
  return { filas: data ?? [], total: count ?? 0 };
}

export async function obtenerSolicitud(id: string): Promise<SolicitudPricingRow | null> {
  const { data, error } = await supabase
    .from("crm_solicitudes_pricing").select(COLS_SOL).eq("id", id).is("deleted_at", null).maybeSingle();
  if (error) throw error;
  return data;
}

export async function crearSolicitud(input: SolicitudPricingInsert): Promise<SolicitudPricingRow> {
  // folio, estado y autoría los asigna la base.
  const { data, error } = await supabase
    .from("crm_solicitudes_pricing").insert({ ...input, folio: "" }).select(COLS_SOL).single();
  if (error) throw error;
  return data;
}

export async function actualizarSolicitud(id: string, cambios: Partial<SolicitudPricingInsert>): Promise<void> {
  const { folio: _f, estado: _e, organization_id: _o, oportunidad_id: _p, ...resto } = cambios;
  const { data, error } = await supabase
    .from("crm_solicitudes_pricing").update(resto).eq("id", id).select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("LC_PRICING_SIN_PERMISO");
}

async function rpcEstado(fn: "crm_enviar_solicitud_pricing" | "crm_responder_solicitud_pricing" | "crm_cancelar_solicitud_pricing", id: string) {
  const { error } = await supabase.rpc(fn, { p_id: id });
  if (error) throw error;
}
export const enviarSolicitud = (id: string) => rpcEstado("crm_enviar_solicitud_pricing", id);
export const responderSolicitud = (id: string) => rpcEstado("crm_responder_solicitud_pricing", id);
export const cancelarSolicitud = (id: string) => rpcEstado("crm_cancelar_solicitud_pricing", id);

export async function listarOpciones(solicitudId: string): Promise<OpcionPricingRow[]> {
  const { data, error } = await supabase
    .from("crm_pricing_opciones").select("*").eq("solicitud_id", solicitudId)
    .order("orden", { ascending: true }).limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function guardarOpcion(input: {
  id?: string; solicitudId: string; organizationId: string; orden: number; datos: OpcionPricingForm;
}): Promise<void> {
  const fila = { ...input.datos, solicitud_id: input.solicitudId, organization_id: input.organizationId, orden: input.orden };
  const { error } = input.id
    ? await supabase.from("crm_pricing_opciones").update(fila).eq("id", input.id)
    : await supabase.from("crm_pricing_opciones").insert(fila);
  if (error) throw error;
}

export async function eliminarOpcion(id: string): Promise<void> {
  const { error } = await supabase.from("crm_pricing_opciones").delete().eq("id", id);
  if (error) throw error;
}

export interface UsuarioOrg { user_id: string; nombre: string; role: string }
export async function listarUsuariosOrg(): Promise<UsuarioOrg[]> {
  const { data, error } = await supabase.rpc("crm_usuarios_org");
  if (error) throw error;
  return data ?? [];
}
