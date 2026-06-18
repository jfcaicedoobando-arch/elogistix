import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

export async function updateEstadoCotizacion(
  id: string,
  estado: string,
  embarqueId?: string | null,
): Promise<void> {
  const update: Partial<TablesInsert<"cotizaciones">> = {
    estado: estado as TablesInsert<"cotizaciones">["estado"],
  };
  if (embarqueId !== undefined) {
    update.embarque_id = embarqueId;
  }
  const { error } = await supabase
    .from("cotizaciones")
    .update(update)
    .eq("id", id);
  if (error) throw error;
}
