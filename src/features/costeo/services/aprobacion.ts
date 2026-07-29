/**
 * Servicio: aprobación/rechazo/reactivación de tarifas marítimas por operaciones.
 * Wraps del RPC `agente_aprobar_tarifa(_tarifa_id, _estado, _motivo)`.
 */
import { supabase } from "@/integrations/supabase/client";
import { run } from "@/lib/supabase/response";

async function callAprobar(_tarifa_id: string, _estado: string, _motivo: string | null) {
  await run(
    supabase.rpc("agente_aprobar_tarifa", { _tarifa_id, _estado, _motivo: _motivo ?? undefined }),
  );
}


export async function aprobarTarifa(tarifaId: string): Promise<void> {
  await callAprobar(tarifaId, "vigente", null);
}

export async function rechazarTarifa(tarifaId: string, motivo: string): Promise<void> {
  const trimmed = motivo.trim();
  if (trimmed.length < 5) {
    throw new Error("El motivo de rechazo debe tener al menos 5 caracteres.");
  }
  await callAprobar(tarifaId, "rechazada", trimmed);
}

export async function reactivarTarifa(tarifaId: string): Promise<void> {
  await callAprobar(tarifaId, "borrador", null);
}
