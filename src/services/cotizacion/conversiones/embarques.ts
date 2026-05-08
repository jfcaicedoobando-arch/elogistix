/**
 * Cotizaciones — Conversión: Cotización → Embarques (uno por contenedor).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import type { CotizacionRow } from "@/types/cotizacion";
import {
  filtrarCostosParaContenedor,
  mapCostosACostosEmbarque,
} from "@/lib/domain/cotizacion";
import { fromDb } from "@/lib/supabase/cast";

type CotizacionInsert = TablesInsert<"cotizaciones">;
type EmbarqueInsert = TablesInsert<"embarques">;

export async function convertirCotizacionAEmbarques(
  cotizacion: CotizacionRow,
): Promise<Tables<"embarques">[]> {
  const { data: costos, error: errorCostos } = await supabase
    .from("cotizacion_costos")
    .select("*")
    .eq("cotizacion_id", cotizacion.id);
  if (errorCostos) throw errorCostos;

  const numContenedores = cotizacion.num_contenedores ?? 1;
  const embarquesCreados: Tables<"embarques">[] = [];

  for (let i = 0; i < numContenedores; i++) {
    const { data: expediente, error: errorExp } = await supabase.rpc("generar_expediente", {
      tipo_op: cotizacion.tipo,
    });
    if (errorExp) throw errorExp;

    const embarqueInsert: EmbarqueInsert = {
      cotizacion_id: cotizacion.id,
      expediente: expediente as string,
      cliente_id: cotizacion.cliente_id!,
      cliente_nombre: cotizacion.cliente_nombre,
      estado: "Confirmado",
      modo: cotizacion.modo,
      tipo: cotizacion.tipo,
      incoterm: cotizacion.incoterm,
      descripcion_mercancia: cotizacion.descripcion_mercancia,
      peso_kg: cotizacion.peso_kg,
      volumen_m3: cotizacion.volumen_m3,
      piezas: cotizacion.piezas,
      operador: cotizacion.operador,
      tipo_carga: cotizacion.tipo_carga,
      tipo_contenedor: cotizacion.tipo_contenedor,
    };

    const { data: embarque, error: errorEmb } = await supabase
      .from("embarques")
      .insert(embarqueInsert)
      .select()
      .single();
    if (errorEmb) throw errorEmb;

    if (costos && costos.length > 0) {
      const conceptosParaInsertar = filtrarCostosParaContenedor(costos, i);
      if (conceptosParaInsertar.length > 0) {
        const rows = mapCostosACostosEmbarque(
          conceptosParaInsertar,
          embarque.id,
        );
        // Boundary: el mapper de dominio devuelve `moneda: string` (genérico);
        // Supabase tipa la columna como enum "EUR" | "MXN" | "USD". El valor
        // proviene de cotizacion_costos donde la misma constraint ya aplica.
        const rowsForDb = fromDb<TablesInsert<"conceptos_costo">[]>(rows);
        const { error: errorConceptos } = await supabase.from("conceptos_costo").insert(rowsForDb);
        if (errorConceptos) throw errorConceptos;
      }
    }

    embarquesCreados.push(embarque);
  }

  // Marcar cotización como "En operación" y, defensa en profundidad, vincular el primer embarque creado.
  // (El trigger trg_sync_cotizacion_embarque_link ya lo hace, pero lo escribimos también aquí
  // para garantizar consistencia inmediata aunque el trigger sea modificado en el futuro.)
  const primerEmbarqueId = embarquesCreados[0]?.id ?? null;
  const { error: errorUpdate } = await supabase
    .from("cotizaciones")
    .update({
      estado: "En operación" as CotizacionInsert["estado"],
      embarque_id: primerEmbarqueId,
    })
    .eq("id", cotizacion.id);
  if (errorUpdate) throw errorUpdate;

  return embarquesCreados;
}
