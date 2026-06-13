import { supabase } from "@/integrations/supabase/client";

export interface OportunidadCotizacionRow {
  id: string;
  folio: string;
  estado: string;
  subtotal: number;
  moneda: string;
  created_at: string;
  embarque_id: string | null;
}

export async function fetchOportunidadCotizaciones(
  oportunidadId: string,
): Promise<OportunidadCotizacionRow[]> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("id, folio, estado, subtotal, moneda, created_at, embarque_id")
    .eq("oportunidad_id", oportunidadId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as OportunidadCotizacionRow[];
}
