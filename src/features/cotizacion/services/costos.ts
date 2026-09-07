/**
 * Cotizaciones — Costos (`cotizacion_costos`): CRUD + lookups para hidratación.
 */
import { supabase } from "@/integrations/supabase/client";
import type { CostoCotizacion } from "@/features/cotizacion/types";
import { fromDbChecked } from "@/lib/supabase/cast";
import {
  costosCotizacionDbSchema,
  cotizacionCostosSnapshotDbSchema,
} from "./readSchemas";
import { registrarActividad } from "@/services/bitacora/registrar";
import {
  LC_CONFLICTO_CONCURRENCIA,
  conflictoConcurrenciaError,
} from "@/lib/errors/concurrencia";

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

/** Filas y sello leídos por Postgres dentro del mismo snapshot. */
export interface CotizacionCostosSnapshot {
  costos: CostoCotizacion[];
  updatedAt: string | null;
}

export async function fetchCotizacionCostosSnapshot(
  cotizacionId: string,
): Promise<CotizacionCostosSnapshot> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("updated_at, cotizacion_costos(*)")
    .eq("id", cotizacionId)
    .is("deleted_at", null)
    .is("cotizacion_costos.deleted_at", null)
    .single();
  if (error) throw error;
  const snapshot = fromDbChecked<{
    updated_at: string | null;
    cotizacion_costos: CostoCotizacion[];
  }>(data, cotizacionCostosSnapshotDbSchema);
  assertNotTruncated(snapshot.cotizacion_costos, 500, "cotizacion.costos.snapshot");
  return { costos: snapshot.cotizacion_costos, updatedAt: snapshot.updated_at };
}


/**
 * Resultado del reemplazo de costos.
 *
 * v13.823.169 — dos versiones DISTINTAS, deliberadamente separadas:
 * - `updatedAt`: sello que devolvió la RPC, es decir el de NUESTRA escritura.
 *   Es el único que puede autorizar que el wizard siga con su captura local.
 * - `snapshot`: fotografía coherente posterior (filas + su propio sello) para
 *   mostrar/editar el detalle. Su sello puede ser MÁS NUEVO si alguien más tocó
 *   la cotización entre el reemplazo y la relectura; por eso no se emparejan
 *   nunca las filas de esa fotografía con el sello de la escritura propia.
 */
export interface UpsertCostosResult {
  updatedAt: string | null;
  snapshot: CotizacionCostosSnapshot;
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
  // Falla cerrada en cliente: sin sello no se llama la RPC (el servidor también
  // la rechaza). Evita reemplazar costos sin candado optimista.
  if (!expectedUpdatedAt) throw conflictoConcurrenciaError();
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
    p_expected_updated_at: expectedUpdatedAt,
  });
  if (error) {
    if (error.message?.includes(LC_CONFLICTO_CONCURRENCIA)) throw conflictoConcurrenciaError();
    throw error;
  }
  const selloEscritura = leerSelloEscritura(data);
  await registrarActividad({
    modulo: "cotizaciones",
    accion: "actualizar_costos",
    entidadId: cotizacionId,
    detalles: { total_conceptos: costos.length },
  });
  // La RPC confirma el reemplazo; después leemos filas y sello juntos para no
  // mezclar costos de una versión con el `updated_at` de otra.
  const snapshot = await fetchCotizacionCostosSnapshot(cotizacionId);
  return { updatedAt: selloEscritura, snapshot };
}

/** Extrae `updated_at` del jsonb que devuelve la RPC (sello de la escritura). */
function leerSelloEscritura(data: unknown): string | null {
  if (!data || typeof data !== "object") return null;
  const sello = (data as { updated_at?: unknown }).updated_at;
  return typeof sello === "string" ? sello : null;
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
