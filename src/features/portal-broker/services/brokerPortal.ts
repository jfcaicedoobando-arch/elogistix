/** Llamadas del Portal de Brokers: todo pasa por RPC, nunca por tablas CRM. */
import { supabase } from "@/integrations/supabase/client";
import type { ContactoBroker, EmpresaBroker } from "../domain/altaProspecto";
import { payloadAlta } from "../domain/altaProspecto";

export interface OrgBroker { broker_id: string; organizacion: string }
export interface EmpresaEncontrada { empresa_id: string; nombre: string; tipo: string; etapa: string | null; es_mia: boolean }
export interface SolicitudBroker {
  id: string; empresa: string; organizacion: string; estado: string;
  motivo: string | null; created_at: string; resuelto_at: string | null;
}
export interface PeticionEmpresa { rol_contacto: string; relacion: string; tiempo_cierre: string }

export async function misOrganizaciones(): Promise<OrgBroker[]> {
  const { data, error } = await supabase.rpc("broker_mis_organizaciones");
  if (error) throw error;
  return data ?? [];
}

export async function buscarEmpresa(brokerId: string, texto: string): Promise<EmpresaEncontrada[]> {
  const { data, error } = await supabase.rpc("broker_buscar_empresa", { p_broker_id: brokerId, p_texto: texto });
  if (error) throw error;
  return data ?? [];
}

export async function solicitarEmpresa(brokerId: string, empresaId: string, p: PeticionEmpresa): Promise<void> {
  const { error } = await supabase.rpc("broker_solicitar_empresa", {
    p_broker_id: brokerId, p_empresa_id: empresaId,
    p_rol_contacto: p.rol_contacto.trim(), p_relacion: p.relacion.trim(), p_tiempo_cierre: p.tiempo_cierre.trim(),
  });
  if (error) throw error;
}

export async function altaProspecto(brokerId: string, e: EmpresaBroker, c: readonly ContactoBroker[]): Promise<void> {
  const p = payloadAlta(e, c);
  const { error } = await supabase.rpc("broker_alta_prospecto", {
    p_broker_id: brokerId, p_empresa: p.empresa, p_contactos: p.contactos,
  });
  if (error) throw error;
}

export async function misSolicitudes(): Promise<SolicitudBroker[]> {
  const { data, error } = await supabase.rpc("broker_mis_solicitudes");
  if (error) throw error;
  return data ?? [];
}

export interface ComisionBrokerFila {
  id: string; organizacion: string; empresa: string; factura: string; fecha: string;
  utilidad_mxn: number; porcentaje: number; comision_mxn: number; estado: string; pagada: boolean;
}

export async function misComisiones(): Promise<ComisionBrokerFila[]> {
  const { data, error } = await supabase.rpc("broker_mis_comisiones");
  if (error) throw error;
  return data ?? [];
}
