/**
 * Servicio: aprobación/rechazo/reactivación de tarifas marítimas por operaciones.
 * Wraps del RPC `agente_aprobar_tarifa(_tarifa_id, _estado, _motivo)`.
 */
import { supabase } from "@/integrations/supabase/client";

export async function aprobarTarifa(tarifaId: string): Promise<void> {
  // SAFE-CAST: RPC con tercer parámetro opcional; tipos generados aún no reflejan el _motivo opcional.
  const { error } = await supabase.rpc("agente_aprobar_tarifa", {
    _tarifa_id: tarifaId,
    _estado: "vigente",
    _motivo: null,
  } as never);
  if (error) throw error;
}

export async function rechazarTarifa(tarifaId: string, motivo: string): Promise<void> {
  const trimmed = motivo.trim();
  if (trimmed.length < 5) {
    throw new Error("El motivo de rechazo debe tener al menos 5 caracteres.");
  }
  // SAFE-CAST: ver nota arriba.
  const { error } = await supabase.rpc("agente_aprobar_tarifa", {
    _tarifa_id: tarifaId,
    _estado: "rechazada",
    _motivo: trimmed,
  } as never);
  if (error) throw error;
}

export async function reactivarTarifa(tarifaId: string): Promise<void> {
  // SAFE-CAST: ver nota arriba.
  const { error } = await supabase.rpc("agente_aprobar_tarifa", {
    _tarifa_id: tarifaId,
    _estado: "borrador",
    _motivo: null,
  } as never);
  if (error) throw error;
}
