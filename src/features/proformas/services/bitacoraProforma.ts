/**
 * Lectura focalizada de la bitácora de actividad de una proforma.
 * Une entradas por `entidad_id` (UUID de la proforma) para el feed del detalle.
 */
import { supabase } from "@/integrations/supabase/client";
import type { EntradaBitacora } from "@/types/bitacora";

const BITACORA_COLUMNS =
  "id, usuario_id, usuario_email, accion, modulo, entidad_id, entidad_nombre, detalles, created_at" as const;

export async function fetchBitacoraProforma(
  proformaId: string,
  limite = 50,
): Promise<EntradaBitacora[]> {
  const { data, error } = await supabase
    .from("bitacora_actividad")
    .select(BITACORA_COLUMNS)
    .eq("entidad_id", proformaId)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;
  return (data ?? []) as EntradaBitacora[];
}
