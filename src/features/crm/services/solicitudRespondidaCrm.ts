/**
 * Oportunidades con solicitud de Pricing respondida: al menos una respondida
 * y ninguna enviada esperando respuesta.
 */
import { supabase } from "@/integrations/supabase/client";

export const LLAVE_SOLICITUD_RESPONDIDA = ["crm", "pricing", "oportunidades-respondidas"] as const;

export type EstadoSolicitudOp = { oportunidad_id: string | null; estado: string };

export function oportunidadesConSolicitudRespondida(filas: EstadoSolicitudOp[]): Set<string> {
  const pendientes = new Set(filas.filter((f) => f.estado === "enviada").map((f) => f.oportunidad_id));
  return new Set(filas
    .filter((f) => f.oportunidad_id && f.estado === "respondida" && !pendientes.has(f.oportunidad_id))
    .map((f) => f.oportunidad_id as string));
}

export async function fetchOportunidadesSolicitudRespondida(): Promise<Set<string>> {
  const { data, error } = await supabase.from("crm_solicitudes_pricing")
    .select("oportunidad_id, estado").is("deleted_at", null)
    .in("estado", ["enviada", "respondida"]).not("oportunidad_id", "is", null).limit(5000);
  if (error) throw error;
  return oportunidadesConSolicitudRespondida(data ?? []);
}
