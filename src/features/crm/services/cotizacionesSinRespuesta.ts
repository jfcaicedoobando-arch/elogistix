/**
 * Cotizaciones enviadas a cliente que llevan > N días sin moverse de "Enviada".
 * Señal de "necesita seguimiento ya".
 */
import { supabase } from "@/integrations/supabase/client";

export interface CotizacionSinRespuestaRow {
  id: string;
  folio: string;
  cliente_nombre: string;
  subtotal: number;
  moneda: string;
  created_at: string;
  oportunidad_id: string | null;
  dias: number;
}

export async function fetchCotizacionesSinRespuesta(
  diasUmbral = 5,
  limit = 10,
): Promise<CotizacionSinRespuestaRow[]> {
  const corte = new Date();
  corte.setDate(corte.getDate() - diasUmbral);
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("id, folio, cliente_nombre, subtotal, moneda, created_at, oportunidad_id")
    .eq("estado", "Enviada")
    .lte("created_at", corte.toISOString())
    .order("created_at", { ascending: true })
    .limit(limit);
  if (error) throw error;
  const ahora = Date.now();
  return (data ?? []).map((c) => ({
    id: c.id,
    folio: c.folio,
    cliente_nombre: c.cliente_nombre ?? "",
    subtotal: Number(c.subtotal ?? 0),
    moneda: c.moneda,
    created_at: c.created_at,
    oportunidad_id: c.oportunidad_id,
    dias: Math.floor((ahora - new Date(c.created_at).getTime()) / 86_400_000),
  }));
}
