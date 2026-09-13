// ============= Full file contents =============
/**
 * N-2 · Remediación v15 — lectura puntual de una cotización antes de escribir.
 *
 * Sirve como "sello de tiempo" para el bloqueo optimista: quien va a escribir
 * lee el sello inmediatamente antes y lo manda en el UPDATE; si alguien más
 * guardó en medio, el sello ya no coincide y la escritura se rechaza en vez de
 * pisar el trabajo ajeno.
 *
 * v13.823.360 — la lectura trae también `moneda` y `tipo_cambio_usd`: la
 * sincronización de conceptos de venta desde costos deriva `subtotal`+`moneda`
 * con `derivarSubtotalMoneda`, que exige el TC CONGELADO de la cotización
 * cuando mezcla USD y MXN (en vez de tomar el TC vivo del día).
 */
import { supabase } from "@/integrations/supabase/client";

export interface CotizacionSelloSync {
  updatedAt: string | null;
  moneda: string | null;
  tipoCambioUsd: number | null;
}

export async function fetchCotizacionSelloSync(id: string): Promise<CotizacionSelloSync> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("updated_at, moneda, tipo_cambio_usd")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("La cotización ya no existe o no tienes acceso.");
  return {
    updatedAt: data.updated_at ?? null,
    moneda: data.moneda ?? null,
    tipoCambioUsd: data.tipo_cambio_usd == null ? null : Number(data.tipo_cambio_usd),
  };
}
