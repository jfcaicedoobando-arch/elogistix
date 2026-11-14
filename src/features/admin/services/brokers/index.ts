/** Servicio de brokers: listado (RLS) y alta por invitación (edge). */
import { supabase } from "@/integrations/supabase/client";
import { invokeUserManagement } from "@/services/userManagement/invoke";

export interface BrokerFila {
  id: string;
  nombre: string;
  email: string;
  comision_pct: number;
  comision_kam_pct: number | null;
  activo: boolean;
  user_id: string | null;
  created_at: string;
}

export interface AltaBrokerInput {
  nombre: string;
  email: string;
  comision_pct: number;
  organization_id: string;
}

export async function listarBrokers(organizationId: string): Promise<BrokerFila[]> {
  const { data, error } = await supabase
    .from("crm_brokers")
    .select("id, nombre, email, comision_pct, comision_kam_pct, activo, user_id, created_at")
    .eq("organization_id", organizationId)
    .order("nombre")
    .limit(500);
  if (error) throw error;
  return (data ?? []) as BrokerFila[];
}

export async function crearBroker(input: AltaBrokerInput): Promise<void> {
  const { error } = await invokeUserManagement({ action: "invite-broker", ...input });
  if (error) throw error;
}

export interface ResumenComisionBroker {
  broker_id: string; broker: string; devengado_mxn: number; liquidado_pendiente_mxn: number; pagado_mxn: number;
}
export interface LiquidacionBroker { id: string; broker_id: string; periodo: string; total_mxn: number; estado: string }

export async function setPorcentajesBroker(id: string, brokerPct: number, kamPct: number | null): Promise<void> {
  const { error } = await supabase.rpc("crm_broker_set_porcentajes", {
    // SAFE-CAST: NULL es válido en SQL (el KAM conserva su % normal); los tipos generados no lo reflejan.
    p_broker_id: id, p_broker_pct: brokerPct, p_kam_pct: kamPct as number,
  });
  if (error) throw error;
}

export async function resumenComisionesBroker(): Promise<ResumenComisionBroker[]> {
  const { data, error } = await supabase.rpc("crm_brokers_comisiones_resumen");
  if (error) throw error;
  return data ?? [];
}

export async function liquidacionesPendientesBroker(organizationId: string): Promise<LiquidacionBroker[]> {
  const { data, error } = await supabase
    .from("liquidaciones_broker")
    .select("id, broker_id, periodo, total_mxn, estado")
    .eq("organization_id", organizationId)
    .eq("estado", "Pendiente")
    .order("created_at")
    .limit(200);
  if (error) throw error;
  return (data ?? []) as LiquidacionBroker[];
}

export async function liquidarBroker(brokerId: string, periodo: string): Promise<void> {
  const { error } = await supabase.rpc("crm_generar_liquidacion_broker", { p_broker_id: brokerId, p_periodo: periodo });
  if (error) throw error;
}

export async function pagarLiquidacionBroker(id: string, fecha: string, referencia: string): Promise<void> {
  const { error } = await supabase.rpc("crm_pagar_liquidacion_broker", { p_id: id, p_fecha: fecha, p_referencia: referencia });
  if (error) throw error;
}
