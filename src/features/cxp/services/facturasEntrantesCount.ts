/**
 * Conteo de documentos del buzón CxP pendientes por capturar.
 *
 * v13.502.0 — El sidebar pinta un badge junto a "Buzón de facturas" para que
 * contabilidad vea sin entrar cuántos documentos esperan captura. Se usa
 * `head: true` (sólo cabecera con el count) para no traer filas de más.
 */
import { supabase } from "@/integrations/supabase/client";

export async function fetchEntrantesPorCapturarCount(): Promise<number> {
  const { count, error } = await supabase
    .from("embarque_facturas_entrantes")
    .select("id", { count: "exact", head: true })
    .eq("estado", "por_capturar")
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
}
