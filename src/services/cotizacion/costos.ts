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
): Promise<CostoCotizacion[]> {
  const { error: delError } = await supabase
    .from("cotizacion_costos")
    .delete()
    .eq("cotizacion_id", cotizacionId);
  if (delError) throw delError;

  if (costos.length === 0) return [];

  const rows = costos.map((c) => ({
    cotizacion_id: cotizacionId,
    concepto: c.concepto,
    moneda: c.moneda,
    proveedor: c.proveedor,
    cantidad: c.cantidad,
    costo_unitario: c.costo_unitario,
    precio_venta: c.precio_venta ?? 0,
    unidad_medida: c.unidad_medida ?? "",
    notas: c.notas ?? "",
  }));

  const { data, error } = await supabase.from("cotizacion_costos").insert(rows).select();
  if (error) throw error;
  return fromDb<CostoCotizacion[]>(data ?? []);
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
