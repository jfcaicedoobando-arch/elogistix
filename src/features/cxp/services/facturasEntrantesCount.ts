/**
 * Conteo de documentos del buzón CxP pendientes por capturar.
 *
 * v13.502.0 — El sidebar pinta un badge junto a "Buzón de facturas" para que
 * contabilidad vea sin entrar cuántos documentos esperan captura. Se usa
 * `head: true` (sólo cabecera con el count) para no traer filas de más.
 */
import { supabase } from "@/integrations/supabase/client";

export async function fetchEntrantesPorCapturarCount(
  organizationId: string | null,
): Promise<number> {
  // RNF-12 (Ola 11): la política de lectura admite al super admin sin filtro
  // de tenant y el badge sumaba TODAS las organizaciones. Fail-closed: sin org
  // activa (super admin en modo plataforma) el conteo es 0.
  if (!organizationId) return 0;
  const { count, error } = await supabase
    .from("embarque_facturas_entrantes")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("estado", "por_capturar")
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
}
