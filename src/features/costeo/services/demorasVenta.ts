import { supabase } from "@/integrations/supabase/client";
import { unwrapOr, run } from "@/lib/supabase/response";
import { registrarActividad } from "@/services/bitacora/registrar";

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
  // EC-20: defensa en la mutación — la UI valida, pero cualquier otra vía de
  // captura pasa por aquí. Evita tramos invertidos o días no enteros.
  if (!Number.isInteger(input.desde_dia) || input.desde_dia < 1) {
    throw new Error("El día inicial del tramo debe ser un entero mayor o igual a 1.");
  }
  if (
    input.hasta_dia !== null &&
    (!Number.isInteger(input.hasta_dia) || input.hasta_dia < input.desde_dia)
  ) {
    throw new Error("El día final del tramo debe ser un entero mayor o igual al día inicial.");
  }
  if (!(input.monto_por_dia_usd >= 0)) {
    throw new Error("El monto por día no puede ser negativo.");
  }
  await run(supabase.from("costeo_demoras_venta_tarifa").insert(input));
  await registrarActividad({
    modulo: "costeo",
    accion: "crear_demora_venta",
    entidadNombre: `Tramo ${input.desde_dia}-${input.hasta_dia ?? "∞"} días`,
    detalles: { tipo_contenedor_id: input.tipo_contenedor_id, monto_por_dia_usd: input.monto_por_dia_usd },
  });
}

export async function eliminarDemoraVenta(id: string): Promise<void> {
  await run(supabase.from("costeo_demoras_venta_tarifa").delete().eq("id", id));
  await registrarActividad({
    modulo: "costeo",
    accion: "eliminar_demora_venta",
    entidadId: id,
  });
}
