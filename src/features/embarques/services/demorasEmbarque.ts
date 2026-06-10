import { supabase } from "@/integrations/supabase/client";
import type { DemoraDesglose } from "../types/demoraDesglose";

export async function calcularDemorasEmbarque(embarqueId: string): Promise<DemoraDesglose> {
  const { data, error } = await supabase.rpc("calcular_demoras_embarque", { p_embarque_id: embarqueId });
  if (error) throw error;
  return data as unknown as DemoraDesglose;
}

export async function eliminarDemorasAuto(embarqueId: string): Promise<void> {
  const [c, v] = await Promise.all([
    supabase.from("conceptos_costo").delete().eq("embarque_id", embarqueId).eq("origen", "demoras_auto"),
    supabase.from("conceptos_venta").delete().eq("embarque_id", embarqueId).eq("origen", "demoras_auto"),
  ]);
  if (c.error) throw c.error;
  if (v.error) throw v.error;
}
