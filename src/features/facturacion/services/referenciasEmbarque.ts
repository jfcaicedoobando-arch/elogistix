/**
 * Servicio: lee Expediente + BL Master + BL House desde `embarques` para
 * propagarlos al CFDI. Aislado del hook para respetar la capa
 * Pages → Hooks → Services → Lib (arquitectura baseline).
 */
import { supabase } from "@/integrations/supabase/client";

export interface EmbarqueReferenciasRow {
  expediente: string | null;
  bl_master: string | null;
  bl_house: string | null;
}

export async function fetchReferenciasEmbarque(
  embarqueId: string,
): Promise<EmbarqueReferenciasRow | null> {
  const { data, error } = await supabase
    .from("embarques")
    .select("expediente, bl_master, bl_house")
    .eq("id", embarqueId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error || !data) return null;
  return {
    expediente: data.expediente ?? null,
    bl_master: data.bl_master ?? null,
    bl_house: data.bl_house ?? null,
  };
}
