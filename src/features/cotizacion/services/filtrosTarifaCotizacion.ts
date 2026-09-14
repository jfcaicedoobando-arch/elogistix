/**
 * v13.823.392 · Auditoría cotización→embarque #3: al sustituir una tarifa, el
 * buscador se abría sin filtros y permitía elegir otra ruta o tipo de
 * contenedor. La cerradura real vive en la base (`LC_TARIFA_RUTA_INCOMPATIBLE`
 * / `LC_TARIFA_TIPO_INCOMPATIBLE`); aquí sólo precargamos el buscador con la
 * ruta y el tipo de la tarifa vinculada a la cotización.
 */
import { supabase } from "@/integrations/supabase/client";

export interface FiltrosTarifaCotizacion {
  puertoOrigenId?: string;
  puertoDestinoId?: string;
  tipoContenedorId?: string;
}

export async function fetchFiltrosTarifaCotizacion(
  cotizacionId: string,
): Promise<FiltrosTarifaCotizacion> {
  const { data: cot, error: errCot } = await supabase
    .from("cotizaciones")
    .select("tarifa_id")
    .eq("id", cotizacionId)
    .maybeSingle();
  if (errCot) throw new Error(errCot.message);
  const tarifaId = cot?.tarifa_id ?? null;
  if (!tarifaId) return {};

  const { data: tarifa, error: errTarifa } = await supabase
    .from("costeo_tarifas")
    .select("tipo_contenedor_id, costeo_rutas(puerto_origen_id, puerto_destino_id)")
    .eq("id", tarifaId)
    .maybeSingle();
  if (errTarifa) throw new Error(errTarifa.message);
  if (!tarifa) return {};

  const ruta = (tarifa as { costeo_rutas?: { puerto_origen_id?: string; puerto_destino_id?: string } | null })
    .costeo_rutas;
  return {
    puertoOrigenId: ruta?.puerto_origen_id ?? undefined,
    puertoDestinoId: ruta?.puerto_destino_id ?? undefined,
    tipoContenedorId: tarifa.tipo_contenedor_id ?? undefined,
  };
}
