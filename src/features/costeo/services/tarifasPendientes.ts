/**
 * Service: conteo de tarifas de agente pendientes de primera aprobación.
 * Alcance B: separado de `pendientesReaprobacion` (cotizaciones) porque mide
 * un concepto distinto — trabajo accionable del gerente sobre `costeo_tarifas`.
 */
import { supabase } from "@/integrations/supabase/client";

export async function contarTarifasPendientesAprobacion(
  organizationId: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("costeo_tarifas")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("estado_aprobacion", "borrador");
  if (error) throw error;
  return count ?? 0;
}
