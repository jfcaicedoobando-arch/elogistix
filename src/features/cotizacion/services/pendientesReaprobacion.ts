/**
 * Service: conteos de cotizaciones pendientes de re-aprobación de tarifa.
 * Aislado del hook para respetar Pages→Hooks→Services→Lib.
 */
import { supabase } from "@/integrations/supabase/client";

export async function contarCotizacionesPendientesReaprobacion(): Promise<number> {
  const { count, error } = await supabase
    .from("cotizaciones")
    .select("id", { count: "exact", head: true })
    .eq("estado_revalidacion", "pendiente_reaprobacion");
  if (error) throw error;
  return count ?? 0;
}

export async function contarMisCotizacionesPendientesReaprobacion(
  email: string,
): Promise<number> {
  const { count, error } = await supabase
    .from("cotizaciones")
    .select("id", { count: "exact", head: true })
    .eq("estado_revalidacion", "pendiente_reaprobacion")
    .eq("operador", email);
  if (error) throw error;
  return count ?? 0;
}
