import { supabase } from "@/integrations/supabase/client";
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
  const { error } = await supabase
    .from("cotizaciones")
    .update(update)
    .eq("id", id);
  if (error) throw error;
}
