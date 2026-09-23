import { supabase } from "@/integrations/supabase/client";
import { registrarBitacoraEmbarque } from "./bitacoraEmbarques";
import type { DemoraDesglose } from "../types/demoraDesglose";
import { mapDemorasPayload, type RpcDemorasPayload } from "./demorasEmbarqueMapper";

export async function calcularDemorasEmbarque(embarqueId: string): Promise<DemoraDesglose> {
  const { data, error } = await supabase.rpc("calcular_demoras_embarque", { p_embarque_id: embarqueId });
  if (error) throw error;
  // SAFE-CAST: RPC `calcular_demoras_embarque` no está en supabase/types.ts; el mapper normaliza el JSONB.
  const desglose = mapDemorasPayload((data ?? {}) as unknown as RpcDemorasPayload, embarqueId);
  await registrarBitacoraEmbarque({
    accion: "recalcular_demoras",
    entidadId: embarqueId,
    detalles: { diasExcedidos: desglose.dias_excedidos, sinEventos: desglose.sin_eventos },
  });
  return desglose;
}

/**
 * P2-4: ¿hay conceptos `demoras_auto` realmente persistidos?
 * El botón "Eliminar auto" dependía de un estado local que se perdía al
 * recargar, así que se ofrecía una acción destructiva sin nada que eliminar.
 */
export async function contarDemorasAuto(embarqueId: string): Promise<number> {
  const [costo, venta] = await Promise.all([
    supabase
      .from("conceptos_costo")
      .select("id", { count: "exact", head: true })
      .eq("embarque_id", embarqueId)
      .eq("origen", "demoras_auto")
      .is("deleted_at", null),
    supabase
      .from("conceptos_venta")
      .select("id", { count: "exact", head: true })
      .eq("embarque_id", embarqueId)
      .eq("origen", "demoras_auto")
      .is("deleted_at", null),
  ]);
  if (costo.error) throw costo.error;
  if (venta.error) throw venta.error;
  return (costo.count ?? 0) + (venta.count ?? 0);
}

export async function eliminarDemorasAuto(embarqueId: string): Promise<void> {

  const [c, v] = await Promise.all([
    supabase.from("conceptos_costo").delete().eq("embarque_id", embarqueId).eq("origen", "demoras_auto"),
    supabase.from("conceptos_venta").delete().eq("embarque_id", embarqueId).eq("origen", "demoras_auto"),
  ]);
  if (c.error) throw c.error;
  if (v.error) throw v.error;
  await registrarBitacoraEmbarque({
    accion: "eliminar_demoras_auto",
    entidadId: embarqueId,
  });
}
