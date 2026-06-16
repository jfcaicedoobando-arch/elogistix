/**
 * Servicio: carga una tarifa marítima vinculada a una cotización (por id).
 * Lee de la vista `costeo_tarifas_vigentes_v` para reutilizar la misma forma
 * (`TopTarifaRow`) que devuelve el buscador del módulo Costeo.
 *
 * Si la tarifa ya no existe (fue borrada → FK ON DELETE SET NULL) o ya no está
 * en la vista de vigentes (vencida, reemplazada), devuelve `null` y el caller
 * mostrará el aviso correspondiente.
 */
import { supabase } from "@/integrations/supabase/client";
import type { TopTarifaRow } from "@/features/costeo/types";

export async function fetchTarifaVinculada(tarifaId: string): Promise<TopTarifaRow | null> {
  const { data, error } = await supabase
    .from("costeo_tarifas_vigentes_v")
    .select("*")
    .eq("id", tarifaId)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as TopTarifaRow | null;
}
