import { supabase } from "@/integrations/supabase/client";

export interface OrigenLclManual {
  cotizacionId: string;
  folio: string;
  tarifaWm: number | null;
  minimo: number | null;
  volumenM3: number | null;
  pesoKg: number | null;
  consolidador: string | null;
}

/** Captura LCL manual de la cotización de origen (sin tarifa de catálogo). */
export async function fetchOrigenLclManual(cotizacionId: string): Promise<OrigenLclManual | null> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("id, folio, lcl_tarifa_wm, lcl_minimo_flete, volumen_m3, peso_kg, proveedores:lcl_consolidador_id(nombre)")
    .eq("id", cotizacionId)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.lcl_tarifa_wm == null) return null;
  const prov = data.proveedores as { nombre?: string | null } | null;
  return {
    cotizacionId: data.id,
    folio: data.folio,
    tarifaWm: data.lcl_tarifa_wm,
    minimo: data.lcl_minimo_flete,
    volumenM3: data.volumen_m3,
    pesoKg: data.peso_kg,
    consolidador: prov?.nombre ?? null,
  };
}
