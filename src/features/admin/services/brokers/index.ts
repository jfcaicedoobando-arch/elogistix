/** Servicio de brokers: listado (RLS) y alta por invitación (edge). */
import { supabase } from "@/integrations/supabase/client";
import { invokeUserManagement } from "@/services/userManagement/invoke";

export interface BrokerFila {
  id: string;
  nombre: string;
  email: string;
  comision_pct: number;
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
    .select("id, nombre, email, comision_pct, activo, user_id, created_at")
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
