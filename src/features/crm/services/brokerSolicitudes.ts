/** Bandeja interna de solicitudes de brokers (lectura y resolución por RPC). */
import { supabase } from "@/integrations/supabase/client";

export interface SolicitudPendiente {
  id: string; broker: string; empresa_id: string; empresa: string;
  rol_contacto: string; relacion: string; tiempo_cierre: string; created_at: string;
}

export async function listarSolicitudesBroker(): Promise<SolicitudPendiente[]> {
  const { data, error } = await supabase.rpc("crm_broker_solicitudes_pendientes");
  if (error) throw error;
  return data ?? [];
}

export async function resolverSolicitudBroker(id: string, autorizar: boolean, motivo?: string): Promise<void> {
  const { error } = await supabase.rpc("crm_broker_resolver_solicitud", {
    p_id: id, p_autorizar: autorizar, p_motivo: motivo ?? undefined,
  });
  if (error) throw error;
}
