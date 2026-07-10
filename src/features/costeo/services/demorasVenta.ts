import { supabase } from "@/integrations/supabase/client";
import { unwrapOr, run } from "@/lib/supabase/response";

export interface DemoraVentaTarifa {
  id: string;
  tipo_contenedor_id: string;
  desde_dia: number;
  hasta_dia: number | null;
  monto_por_dia_usd: number;
  vigente_desde: string;
  vigente_hasta: string | null;
  notas: string | null;
}

export type DemoraVentaTarifaInput = Omit<DemoraVentaTarifa, 'id'>;

export async function fetchDemorasVenta(): Promise<DemoraVentaTarifa[]> {
  return unwrapOr(
    supabase
      .from("costeo_demoras_venta_tarifa")
      .select("id, tipo_contenedor_id, desde_dia, hasta_dia, monto_por_dia_usd, vigente_desde, vigente_hasta, notas")
      .order("tipo_contenedor_id")
      .order("desde_dia"),
    [],
  ) as Promise<DemoraVentaTarifa[]>;
}

export async function crearDemoraVenta(input: DemoraVentaTarifaInput): Promise<void> {
  await run(supabase.from("costeo_demoras_venta_tarifa").insert(input));
}

export async function eliminarDemoraVenta(id: string): Promise<void> {
  await run(supabase.from("costeo_demoras_venta_tarifa").delete().eq("id", id));
}
