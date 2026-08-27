/**
 * Cotizaciones enviadas a cliente que llevan > N días sin moverse de "Enviada".
 * Señal de "necesita seguimiento ya".
 */
import { supabase } from "@/integrations/supabase/client";
import { diffDiasCalendario } from "@/lib/date/dateOnly";

export interface CotizacionSinRespuestaRow {
  id: string;
  folio: string;
  cliente_nombre: string;
  subtotal: number;
  moneda: string;
  created_at: string;
  oportunidad_id: string | null;
  es_prospecto: boolean;
  dias: number;
}

/** Segmento opcional: separa el seguimiento de prospección del de clientes. */
export type SegmentoSinRespuesta = "clientes" | "prospectos" | "todas";

export async function fetchCotizacionesSinRespuesta(
  diasUmbral = 5,
  limit = 10,
  segmento: SegmentoSinRespuesta = "todas",
): Promise<CotizacionSinRespuestaRow[]> {
  const corte = new Date();
  corte.setDate(corte.getDate() - diasUmbral);
  let query = supabase
    .from("cotizaciones")
    .select("id, folio, cliente_nombre, es_prospecto, prospecto_empresa, subtotal, moneda, created_at, oportunidad_id")
    .eq("estado", "Enviada")
    .lte("created_at", corte.toISOString())
    // v13.756.0: una cotización eliminada ya no requiere seguimiento.
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (segmento !== "todas") {
    query = query.eq("es_prospecto", segmento === "prospectos");
  }
  const { data, error } = await query;
  if (error) throw error;
  const ahora = Date.now();
  return (data ?? []).map((c) => ({
    id: c.id,
    folio: c.folio,
    cliente_nombre: (c.es_prospecto ? c.prospecto_empresa : c.cliente_nombre) ?? "",
    subtotal: Number(c.subtotal ?? 0),
    moneda: c.moneda,
    created_at: c.created_at,
    oportunidad_id: c.oportunidad_id,
    es_prospecto: c.es_prospecto === true,
    dias: diffDiasCalendario(c.created_at, new Date(ahora)),
  }));
}
