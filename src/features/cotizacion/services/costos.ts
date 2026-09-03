/**
 * Cotizaciones — Costos (`cotizacion_costos`): CRUD + lookups para hidratación.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CostoCotizacion } from "@/features/cotizacion/types";
import { fromDbChecked } from "@/lib/supabase/cast";
import { costosCotizacionDbSchema } from "./readSchemas";
import { registrarActividad } from "@/services/bitacora/registrar";
import { assertNotTruncated } from "@/lib/supabase/assertNotTruncated";
import { CAP_LISTA } from "@/constants/queryCaps";

export async function fetchCotizacionCostos(
  cotizacionId: string,
): Promise<CostoCotizacion[]> {
  const { data, error } = await supabase
    .from("cotizacion_costos")
    .select("*").is("deleted_at", null)
    .eq("cotizacion_id", cotizacionId)
    // EC-05: límite defensivo sobre partidas de costo de una cotización.
    .limit(CAP_LISTA);
  if (error) throw error;
  assertNotTruncated(data, 500, "cotizacion.costos");
  // M2: valida montos/identidad en el boundary de dinero antes del dominio.
  return fromDbChecked<CostoCotizacion[]>(data ?? [], costosCotizacionDbSchema);
}


/**
 * Resultado del reemplazo de costos: filas canónicas + nuevo sello de la
 * cotización (v13.823.69). El sello permite que el paso 2 participe del mismo
 * bloqueo optimista que los demás pasos del wizard.
 */
export interface UpsertCostosResult {
  costos: CostoCotizacion[];
  updatedAt: string | null;
}

export async function upsertCotizacionCostos(
  cotizacionId: string,
  costos: CostoCotizacion[],
  requestId?: string,
  /**
   * v13.823.69: sello (`cotizaciones.updated_at`) esperado. La RPC bloquea la
   * cotización, compara y sólo entonces reemplaza los costos; si no coincide no
   * borra ni inserta nada y lanza LC_CONFLICTO_CONCURRENCIA.
   */
  expectedUpdatedAt?: string | null,
): Promise<UpsertCostosResult> {
  const { data, error } = await supabase.rpc("actualizar_cotizacion_costos", {
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
    ...(expectedUpdatedAt ? { p_expected_updated_at: expectedUpdatedAt } : {}),
  });
  if (error) {
    if (error.message?.includes(LC_CONFLICTO_CONCURRENCIA)) throw conflictoConcurrenciaError();
    throw error;
  }
  await registrarActividad({
    modulo: "cotizaciones",
    accion: "actualizar_costos",
    entidadId: cotizacionId,
    detalles: { total_conceptos: costos.length },
  });
  const sello =
    data && typeof data === "object" && !Array.isArray(data)
      ? (data as Record<string, unknown>).updated_at
      : null;
  // Re-leemos para devolver los registros canónicos (con id/timestamps/totales calculados).
  return {
    costos: await fetchCotizacionCostos(cotizacionId),
    updatedAt: typeof sello === "string" ? sello : null,
  };
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
    .select("concepto, costo_unitario, moneda, proveedor").is("deleted_at", null)
    .eq("cotizacion_id", cotizacionId);
  if (error) throw new Error(error.message);
  return (data ?? []) as CotizacionCostoLookup[];
}
