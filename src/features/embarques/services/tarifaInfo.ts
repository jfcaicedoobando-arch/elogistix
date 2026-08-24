/**
 * Servicio: lee los campos de decisión de tarifa de un embarque.
 * Movido fuera del hook para respetar la jerarquía Pages→Hooks→Services→Lib.
 *
 * FIX2 · B-1: `tarifa_delta_jsonb` ya no es legible en `embarques` para
 * `authenticated`; se obtiene por `embarques_interno_v` (sólo staff).
 */
import { supabase } from "@/integrations/supabase/client";
import { obtenerEmbarqueInterno } from "./internoEmbarque";

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
      "tarifa_id_original, tarifa_id_aplicada, tarifa_decision, tarifa_revalidada_en",
    )
    .eq("id", embarqueId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const interno = await obtenerEmbarqueInterno(embarqueId);
  return {
    tarifa_id_original: data.tarifa_id_original ?? null,
    tarifa_id_aplicada: data.tarifa_id_aplicada ?? null,
    tarifa_decision: data.tarifa_decision ?? null,
    tarifa_delta_jsonb: interno?.tarifa_delta_jsonb ?? null,
    tarifa_revalidada_en: data.tarifa_revalidada_en ?? null,
  };
}
