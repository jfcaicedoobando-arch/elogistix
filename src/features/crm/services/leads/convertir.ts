/**
 * Leads — conversión a cliente + oportunidad.
 */
import { supabase } from "@/integrations/supabase/client";
import { type CrmLeadRow } from "@/features/crm/domain/leads/constants";
import { type AuthLite } from "@/features/crm/domain/leads/leadPayload";
import { registrarActividad } from "@/services/bitacora/registrar";

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
    const { data, error } = await supabase
      .from("clientes")
      .select("nombre")
      .eq("id", p.clienteIdExistente)
      .maybeSingle();
    if (error) throw error;
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
  _user: AuthLite | null,
): Promise<{ clienteId: string | null; oportunidadId: string }> {
  // Ola 6 · M4: cliente + oportunidad + marcado del lead en UNA transacción
  // idempotente. Antes, un fallo intermedio dejaba cliente/oportunidad huérfanos.
  // SAFE-CAST: la RPC acepta NULL en p_cliente_id / p_fecha_estimada_cierre, pero los
  // tipos generados por Supabase los exponen como requeridos; el cast sólo cierra ese gap.
  const rpcArgs = {
    p_lead_id: params.lead.id,
    p_crear_cliente: params.crearCliente,
    p_cliente_id: params.clienteIdExistente ?? null,
    p_nombre_oportunidad: params.nombreOportunidad,
    p_monto_estimado: params.montoEstimado,
    p_moneda: params.moneda,
    p_fecha_estimada_cierre: params.fechaEstimadaCierre ?? null,
  } as unknown as Parameters<typeof supabase.rpc<"convertir_lead_rpc">>[1];
  const { data, error } = await supabase.rpc("convertir_lead_rpc", rpcArgs);

  if (error) throw error;
  const payload = (data ?? {}) as { cliente_id?: string | null; oportunidad_id?: string };
  if (!payload.oportunidad_id) throw new Error("No se pudo convertir el lead");

  await registrarActividad({
    modulo: "crm",
    accion: "Convirtió lead a oportunidad",
    entidadId: params.lead.id,
    entidadNombre: params.lead.empresa,
    detalles: { oportunidadId: payload.oportunidad_id, clienteId: payload.cliente_id ?? null },
  });

  return { clienteId: payload.cliente_id ?? null, oportunidadId: payload.oportunidad_id };
}
