/**
 * Servicio: lee los campos de decisión de tarifa de un embarque.
 * Movido fuera del hook para respetar la jerarquía Pages→Hooks→Services→Lib.
 */
import { supabase } from "@/integrations/supabase/client";

export interface EmbarqueTarifaInfo {
  tarifa_id_original: string | null;
  tarifa_id_aplicada: string | null;
  tarifa_decision: string | null;
  tarifa_delta_jsonb: unknown;
  tarifa_revalidada_en: string | null;
}

export async function obtenerEmbarqueTarifaInfo(
  embarqueId: string,
): Promise<EmbarqueTarifaInfo | null> {
  const { data, error } = await supabase
    .from("embarques")
    .select(
      "tarifa_id_original, tarifa_id_aplicada, tarifa_decision, tarifa_delta_jsonb, tarifa_revalidada_en",
    )
    .eq("id", embarqueId)
    .maybeSingle();
  if (error) throw error;
  // SAFE-CAST: la fila puede no existir aún (embarques nuevos sin metadata).
  return (data as unknown as EmbarqueTarifaInfo | null) ?? null;
}
