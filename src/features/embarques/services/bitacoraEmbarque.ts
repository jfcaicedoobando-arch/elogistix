/**
 * Lecturas focalizadas de la bitácora de actividad para un embarque concreto.
 * Une registros por `entidad_id` (UUID) o `entidad_nombre` (expediente) para
 * incluir entradas históricas que se guardaron sin el id resuelto.
 */
import { supabase } from "@/integrations/supabase/client";
import type { EntradaBitacora } from "@/types/bitacora";

const BITACORA_COLUMNS =
  "id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles, created_at" as const;

export async function fetchBitacoraEmbarque(
  embarqueId: string,
  expediente: string | null | undefined,
  limite = 100,
): Promise<EntradaBitacora[]> {
  // OR sobre dos columnas para tolerar entradas con entidad_id nulo (legacy).
  const orFilter = expediente
    ? `entidad_id.eq.${embarqueId},and(entidad_id.is.null,entidad_nombre.eq.${expediente})`
    : `entidad_id.eq.${embarqueId}`;
  const { data, error } = await supabase
    .from("bitacora_actividad")
    .select(BITACORA_COLUMNS)
    .or(orFilter)
    .order("created_at", { ascending: false })
    // L1 (auditoría 3-3): desempate estable para que la paginación no repita filas.
    .order("id", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []) as EntradaBitacora[];
}
