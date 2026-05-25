import { supabase } from "@/integrations/supabase/client";
import type { CrmLeadRow } from "./constants";

export interface ResolveClienteParams {
  lead: CrmLeadRow;
  crearCliente: boolean;
  clienteIdExistente?: string | null;
}

/** Resuelve el cliente para una conversión: crea uno nuevo o busca el existente. */
export async function resolveClienteForConversion(p: ResolveClienteParams): Promise<{ clienteId: string | null; clienteNombre: string }> {
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

/** Busca la primera etapa abierta activa del pipeline. */
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
