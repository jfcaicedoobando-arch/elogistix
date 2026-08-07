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

  await registrarActividad({
    modulo: "crm",
    accion: "Convirtió lead a oportunidad",
    entidadId: params.lead.id,
    entidadNombre: params.lead.empresa,
    detalles: { oportunidadId: opNueva.id, clienteId },
  });

  return { clienteId, oportunidadId: opNueva.id };
}
