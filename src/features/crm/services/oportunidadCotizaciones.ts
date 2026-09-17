import { supabase } from "@/integrations/supabase/client";

export interface OportunidadCotizacionRow {
  id: string;
  folio: string;
  estado: string;
  subtotal: number;
  moneda: string;
  created_at: string;
  /** CRM-P2.4: fecha real de envío al cliente (null si nunca se envió). */
  fecha_envio: string | null;
  embarque_id: string | null;
}

export async function fetchOportunidadCotizaciones(
  oportunidadId: string,
): Promise<OportunidadCotizacionRow[]> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("id, folio, estado, subtotal, moneda, created_at, fecha_envio, embarque_id")
    .eq("oportunidad_id", oportunidadId)
    // v13.756.0: sólo cotizaciones vivas dentro de la oportunidad.
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OportunidadCotizacionRow[];
}
