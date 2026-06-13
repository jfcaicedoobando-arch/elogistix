import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";

export async function updateEstadoCotizacion(id: string, estado: string): Promise<void> {
  const { error } = await supabase
    .from("cotizaciones")
    .update({ estado: estado as TablesInsert<"cotizaciones">["estado"] })
    .eq("id", id);
  if (error) throw error;
}
