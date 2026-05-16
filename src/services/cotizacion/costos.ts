/**
 * Cotizaciones — Costos (`cotizacion_costos`): CRUD + lookups para hidratación.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CostoCotizacion } from "@/types/cotizacionCosto";
import { fromDb } from "@/lib/supabase/cast";

export async function fetchCotizacionCostos(
  cotizacionId: string,
): Promise<CostoCotizacion[]> {
  const { data, error } = await supabase
    .from("cotizacion_costos")
    .select("*")
    .eq("cotizacion_id", cotizacionId);
  if (error) throw error;
  return fromDb<CostoCotizacion[]>(data ?? []);
}

export async function upsertCotizacionCostos(
  cotizacionId: string,
  costos: CostoCotizacion[],
  requestId?: string,
): Promise<CostoCotizacion[]> {
  const { error } = await supabase.rpc("actualizar_cotizacion_costos", {
    p_cotizacion_id: cotizacionId,
    p_costos: costos.map((c) => ({
      concepto: c.concepto,
      moneda: c.moneda,
      proveedor: c.proveedor,
      cantidad: c.cantidad,
      costo_unitario: c.costo_unitario,
      precio_venta: c.precio_venta ?? 0,
      unidad_medida: c.unidad_medida ?? "",
      notas: c.notas ?? "",
    })),
    p_request_id: requestId,
  });
  if (error) throw error;
  // Re-leemos para devolver los registros canónicos (con id/timestamps/totales calculados).
  return fetchCotizacionCostos(cotizacionId);
}

// ─── Lookups para hidratación de embarque vinculado ─────────────────────────
export interface CotizacionCostoLookup {
  concepto: string;
  costo_unitario: number | string | null;
  moneda: string | null;
  proveedor: string | null;
}


export async function fetchCotizacionCostosForEmbarque(
  cotizacionId: string,
): Promise<CotizacionCostoLookup[]> {
  const { data, error } = await supabase
    .from("cotizacion_costos")
    .select("concepto, costo_unitario, moneda, proveedor")
    .eq("cotizacion_id", cotizacionId);
  if (error) throw new Error(error.message);
  return (data ?? []) as CotizacionCostoLookup[];
}
