import { supabase } from "@/integrations/supabase/client";
import { registrarActividad } from "@/services/bitacora/registrar";
import type { TablesInsert } from "@/integrations/supabase/types";

/**
 * Estados válidos del enum `estado_cotizacion` en la base de datos.
 * Sincronizado con `src/integrations/supabase/types.ts` (líneas 7044-7052).
 * Si la BD agrega un estado, agregarlo aquí o el guard rechazará la transición.
 */
export const ESTADOS_COTIZACION_VALIDOS = [
  "Borrador",
  "Solicitada",
  "Enviada",
  "Aceptada",
  "Rechazada",
  "Vencida",
  "En operación",
  "Archivada",
] as const;

export type EstadoCotizacion = (typeof ESTADOS_COTIZACION_VALIDOS)[number];

function esEstadoValido(estado: string): estado is EstadoCotizacion {
  return (ESTADOS_COTIZACION_VALIDOS as readonly string[]).includes(estado);
}

export async function updateEstadoCotizacion(
  id: string,
  estado: string,
  embarqueId?: string | null,
): Promise<void> {
  // Sprint 1.4 (13.115.0): rechazar estados inválidos antes de tocar la BD.
  // Antes, este service aceptaba cualquier string y dejaba que Postgres tirara
  // un error críptico de enum. Ahora falla rápido con mensaje legible.
  if (!esEstadoValido(estado)) {
    throw new Error(
      `Estado de cotización inválido: "${estado}". Valores permitidos: ${ESTADOS_COTIZACION_VALIDOS.join(", ")}`,
    );
  }
  const update: Partial<TablesInsert<"cotizaciones">> = {
    estado: estado as TablesInsert<"cotizaciones">["estado"],
  };
  if (embarqueId !== undefined) {
    update.embarque_id = embarqueId;
  }
  // v13.814.0 (hallazgo 1): un UPDATE filtrado por RLS o sobre un id
  // inexistente no da error, devuelve 0 filas. La bitácora sólo se escribe
  // después de confirmar que la fila cambió.
  const { data, error } = await supabase
    .from("cotizaciones")
    .update(update)
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw error;
  if (!data) {
    throw new Error(
      "No se pudo cambiar el estado de la cotización: no tienes permiso o la cotización ya no existe.",
    );
  }
  await registrarActividad({
    modulo: "cotizaciones",
    accion: "cambiar_estado",
    entidadId: id,
    detalles: { estado_nuevo: estado, embarque_id: embarqueId ?? null },
  });
  // R7-FIX5: la notificación al portal del cliente la crea el trigger
  // `notificar_cotizacion_enviada` en la BD (SECURITY DEFINER e idempotente).
  // Antes se insertaba desde aquí y RLS la bloqueaba para varios roles.
}
