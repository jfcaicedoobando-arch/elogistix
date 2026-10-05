/**
 * Tarifas del catálogo que responden a una solicitud de pricing.
 * La respuesta de pricing ES la tarifa (ligada por `solicitud_pricing_id`).
 */
import { supabase } from "@/integrations/supabase/client";
import { fromDb } from "@/lib/supabase/cast";
import { tarifasRespuestaDbSchema } from "./readSchemas";

export interface TarifaRespuestaRow {
  id: string;
  flete_base: number;
  moneda: string;
  unidad_flete: string | null;
  carta_garantia: boolean | null;
  transit_time_dias: number | null;
  vigente_hasta: string | null;
  agente: { nombre: string } | null;
  naviera: { name: string } | null;
  tipo: { code: string } | null;
  ruta: { origen: { name: string } | null; destino: { name: string } | null } | null;
}

const COLS = [
  "id, flete_base, moneda, unidad_flete, carta_garantia, transit_time_dias, vigente_hasta",
  "agente:costeo_agentes(nombre), naviera:navieras(name), tipo:tipos_contenedor(code)",
  "ruta:costeo_rutas(origen:puertos!costeo_rutas_puerto_origen_id_fkey(name), destino:puertos!costeo_rutas_puerto_destino_id_fkey(name))",
].join(", ");

export async function listarTarifasRespuesta(solicitudId: string): Promise<TarifaRespuestaRow[]> {
  const { data, error } = await supabase
    .from("costeo_tarifas").select(COLS)
    .eq("solicitud_pricing_id", solicitudId)
    .order("created_at", { ascending: true }).limit(50);
  if (error) throw error;
  return fromDb(data ?? [], tarifasRespuestaDbSchema);
}
