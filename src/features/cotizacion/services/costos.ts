/**
 * Cotizaciones — Costos (`cotizacion_costos`): CRUD + lookups para hidratación.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CostoCotizacion } from "@/features/cotizacion/types";
import { fromDbChecked } from "@/lib/supabase/cast";
import { costosCotizacionDbSchema } from "./readSchemas";

export async function fetchCotizacionCostos(
  cotizacionId: string,
): Promise<CostoCotizacion[]> {
  const { data, error } = await supabase
    .from("cotizacion_costos")
    .select("*")
    .eq("cotizacion_id", cotizacionId);
  if (error) throw error;
  // M2: valida montos/identidad en el boundary de dinero antes del dominio.
  return fromDbChecked<CostoCotizacion[]>(data ?? [], costosCotizacionDbSchema);
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
      // B-073: la RPC los inserta desde la migración b073 (antes los ignoraba).
      costeo_tarifa_id: c.costeo_tarifa_id ?? null,
      costeo_tarifa_recargo_id: c.costeo_tarifa_recargo_id ?? null,
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
