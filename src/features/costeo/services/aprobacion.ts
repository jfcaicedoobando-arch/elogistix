/**
 * Servicio: aprobación/rechazo/reactivación de tarifas marítimas por operaciones.
 * Wraps del RPC `agente_aprobar_tarifa(_tarifa_id, _estado, _motivo)`.
 */
import { supabase } from "@/integrations/supabase/client";
import { run, unwrap } from "@/lib/supabase/response";
import { registrarActividad } from "@/services/bitacora/registrar";
import { puedeAprobarTarifa, MENSAJE_VIGENCIA_VENCIDA } from "@/features/costeo/utils/vigenciaTarifa";
import { todayLocalISO } from "@/lib/date/today";

async function callAprobar(_tarifa_id: string, _estado: string, _motivo: string | null) {
  await run(
    supabase.rpc("agente_aprobar_tarifa", { _tarifa_id, _estado, _motivo: _motivo ?? undefined }),
  );
}


export async function aprobarTarifa(tarifaId: string): Promise<void> {
  await callAprobar(tarifaId, "vigente", null);
  await registrarActividad({
    modulo: "costeo",
    accion: "aprobar_tarifa",
    entidadId: tarifaId,
  });
}

/**
 * Lee la vigencia canónica desde la base (la fila de la UI puede estar
 * obsoleta) para poder aplicar el guard sin confiar en el componente.
 */
export async function leerVigenciaTarifa(tarifaId: string): Promise<string> {
  const row = await unwrap<{ vigente_hasta: string }>(
    supabase.from("costeo_tarifas").select("vigente_hasta").eq("id", tarifaId).single(),
  );
  return row.vigente_hasta;
}

/**
 * Aprueba una tarifa sólo si su vigencia canónica (releída por id) no venció
 * respecto al día de negocio México. Si la lectura falla, NO aprueba.
 */
export async function aprobarTarifaVerificada(tarifaId: string): Promise<void> {
  const vigenteHasta = await leerVigenciaTarifa(tarifaId);
  if (!puedeAprobarTarifa({ vigenteHasta, hoy: todayLocalISO() })) {
    throw new Error(MENSAJE_VIGENCIA_VENCIDA);
  }
  await aprobarTarifa(tarifaId);
}

export async function rechazarTarifa(tarifaId: string, motivo: string): Promise<void> {
  const trimmed = motivo.trim();
  if (trimmed.length < 5) {
    throw new Error("El motivo de rechazo debe tener al menos 5 caracteres.");
  }
  await callAprobar(tarifaId, "rechazada", trimmed);
  await registrarActividad({
    modulo: "costeo",
    accion: "rechazar_tarifa",
    entidadId: tarifaId,
    detalles: { motivo: trimmed },
  });
}

export async function reactivarTarifa(tarifaId: string): Promise<void> {
  await callAprobar(tarifaId, "borrador", null);
  await registrarActividad({
    modulo: "costeo",
    accion: "reactivar_tarifa",
    entidadId: tarifaId,
  });
}
