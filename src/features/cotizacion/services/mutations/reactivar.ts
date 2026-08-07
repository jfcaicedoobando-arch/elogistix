import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { registrarActividad } from "@/services/bitacora/registrar";

/**
 * Reactiva una cotización que fue marcada automáticamente como
 * "Vencida" o "Archivada" por el job de housekeeping.
 * Restaura `estado_anterior` (o "Borrador" como fallback) y limpia el campo.
 */
export async function reactivarCotizacion(id: string): Promise<string> {
  // SAFE-CAST: estado_anterior es del mismo enum estado_cotizacion pero
  // los types generados aún no incluyen la columna nueva hasta el próximo refresh.
  const { data: row, error: readErr } = await supabase
    .from("cotizaciones")
    .select("estado, estado_anterior")
    .eq("id", id)
    .single();
  if (readErr) throw readErr;

  type RowConEstadoAnterior = { estado: string; estado_anterior: string | null };
  // SAFE-CAST: estado_anterior aún no existe en types regenerados.
  const r = row as unknown as RowConEstadoAnterior;
  const nuevoEstado = (r.estado_anterior && r.estado_anterior !== "Vencida" && r.estado_anterior !== "Archivada")
    ? r.estado_anterior
    : "Borrador";

  const { error } = await supabase
    .from("cotizaciones")
    .update({
      estado: nuevoEstado as TablesInsert<"cotizaciones">["estado"],
      // SAFE-CAST: estado_anterior aún no existe en types regenerados.
      ...({ estado_anterior: null } as Record<string, unknown>),
    })
    .eq("id", id);
  if (error) throw error;

  await registrarActividad({
    modulo: "cotizaciones",
    accion: "Reactivó cotización",
    entidadId: id,
    detalles: { estado_anterior: r.estado, estado_nuevo: nuevoEstado },
  });

  return nuevoEstado;
}
