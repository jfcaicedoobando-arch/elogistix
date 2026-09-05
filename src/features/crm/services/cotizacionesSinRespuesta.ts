/**
 * Cotizaciones enviadas a cliente que llevan > N días sin moverse de "Enviada".
 * Señal de "necesita seguimiento ya".
 */
import { supabase } from "@/integrations/supabase/client";
import { diffDiasMx, mxAddDaysIso } from "@/lib/date/mx";

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
  /**
   * Tanda 2 · hallazgo 1: cuando se pide desde una tarjeta personal ("mi
   * seguimiento") se limita a las cotizaciones creadas por el usuario.
   * `cotizaciones` no tiene vendedor: `created_by` es el dueño del seguimiento.
   */
  vendedorId?: string | null,
): Promise<CotizacionSinRespuestaRow[]> {
  // El corte se calcula sobre el calendario CDMX para no depender del huso
  // del navegador (antes `setDate()` movía el día para usuarios en UTC).
  const ahora = new Date();
  const corte = mxAddDaysIso(ahora.toISOString(), -diasUmbral, ahora);
  let query = supabase
    .from("cotizaciones")
    .select("id, folio, cliente_nombre, es_prospecto, prospecto_empresa, subtotal, moneda, created_at, oportunidad_id")
    .eq("estado", "Enviada")
    .lte("created_at", corte)
    // v13.756.0: una cotización eliminada ya no requiere seguimiento.
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(limit);
  if (segmento !== "todas") {
    query = query.eq("es_prospecto", segmento === "prospectos");
  }
  if (vendedorId) query = query.eq("created_by", vendedorId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    folio: c.folio,
    cliente_nombre: (c.es_prospecto ? c.prospecto_empresa : c.cliente_nombre) ?? "",
    subtotal: Number(c.subtotal ?? 0),
    moneda: c.moneda,
    created_at: c.created_at,
    oportunidad_id: c.oportunidad_id,
    es_prospecto: c.es_prospecto === true,
    dias: diffDiasMx(c.created_at, ahora) ?? 0,
  }));
}
