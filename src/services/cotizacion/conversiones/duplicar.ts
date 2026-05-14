/**
 * Cotizaciones — Conversión: Duplicar.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json, TablesInsert } from "@/integrations/supabase/types";
import { calcularFechaVigencia } from "@/lib/domain/cotizacion";
import { generarFolioCotizacion } from "../queries";

type CotizacionInsert = TablesInsert<"cotizaciones">;

export async function duplicarCotizacion(
  cotizacionId: string,
): Promise<{ id: string; folio: string }> {
  const { data: orig, error: errOrig } = await supabase
    .from("cotizaciones")
    .select("*")
    .eq("id", cotizacionId)
    .single();
  if (errOrig) throw errOrig;

  const folio = await generarFolioCotizacion();
  const fechaVigencia = calcularFechaVigencia(new Date(), orig.vigencia_dias);

  const {
    id: _id,
    created_at: _ca,
    updated_at: _ua,
    folio: _f,
    estado: _e,
    embarque_id: _eid,
    fecha_vigencia: _fv,
    ...rest
  } = orig;

  const payload: CotizacionInsert = {
    ...rest,
    folio,
    estado: "Borrador",
    embarque_id: null,
    fecha_vigencia: fechaVigencia,
    conceptos_venta: rest.conceptos_venta as Json,
    dimensiones_lcl: rest.dimensiones_lcl as Json,
    dimensiones_aereas: rest.dimensiones_aereas as Json,
  } as CotizacionInsert;

  const { data, error } = await supabase
    .from("cotizaciones")
    .insert(payload)
    .select("id, folio")
    .single();
  if (error) throw error;

  const { data: costos } = await supabase
    .from("cotizacion_costos")
    .select("*")
    .eq("cotizacion_id", cotizacionId);
  if (costos && costos.length > 0) {
    const nuevos = costos.map(
      ({ id: _cid, created_at: _cca, updated_at: _cua, cotizacion_id: _ccid, ...c }) => ({
        ...c,
        cotizacion_id: data.id,
      }),
    );
    await supabase.from("cotizacion_costos").insert(nuevos);
  }

  return data as { id: string; folio: string };
}
