/**
 * Cotizaciones — Lecturas (listado, detalle, embarques vinculados, folio).
 */
import { supabase } from "@/integrations/supabase/client";
import type { CotizacionRow } from "@/features/cotizacion/types";
import { fromDbChecked } from "@/lib/supabase/cast";
import { cotizacionRowDbSchema, cotizacionRowsDbSchema } from "./readSchemas";

import { unwrap, unwrapOr } from "@/lib/supabase/response";
import { CAP_POSTGREST } from "@/constants/queryCaps";

// ─── Columnas reutilizables ─────────────────────────────────────────────────
// `cotizacion_costos(count)` agrega el conteo de filas relacionadas, que
// usamos para decidir si una cotización tiene costos cargados o sigue
// "Sin costos" (v13.29.0).
export const COTIZACION_LIST_COLUMNS =
  "id, folio, cliente_id, cliente_nombre, es_prospecto, prospecto_empresa, modo, origen, destino, subtotal, moneda, estado, fecha_vigencia, created_at, descripcion_mercancia, conceptos_venta, tipo_documento, vigencia_desde, vigencia_hasta, sin_desglose_costos, estado_revalidacion, origen_portal, tarifa_id, embarque_id, cotizacion_costos(count), costeo_tarifas:tarifa_id(vigente_hasta)" as const;

export const COTIZACION_ACEPTADA_COLUMNS =
  "id, folio, cliente_id, cliente_nombre, modo, tipo, incoterm, descripcion_mercancia, tipo_carga, tipo_contenedor, peso_kg, volumen_m3, piezas, operador, origen, destino, notas" as const;

// ─── Folio helper ───────────────────────────────────────────────────────────
/**
 * v13.303.0 (FIX-05): folio atómico vía RPC `siguiente_folio_cotizacion()`.
 * Antes se calculaba con `MAX(folio) + 1` en orden lexicográfico, con dos
 * bugs: race condition entre altas concurrentes y colisión al pasar de
 * `COT-YYYY-9999` a `COT-YYYY-10000` (porque `"10000" < "9999"` como texto).
 *
 * Se mantiene el wrapper por compatibilidad — lo usan `informativa.ts` y el
 * flujo CRM `useCrearCotizacionDesdeOportunidad`.
 */
export async function generarFolioCotizacion(): Promise<string> {
  const { data, error } = await supabase.rpc("siguiente_folio_cotizacion");
  if (error) throw error;
  if (!data || typeof data !== "string") {
    throw new Error("No se pudo generar el folio de cotización");
  }
  return data;
}


// ─── Queries ────────────────────────────────────────────────────────────────
export async function fetchCotizaciones(organizationId: string | null) {
  let query = supabase
    .from("cotizaciones")
    .select(COTIZACION_LIST_COLUMNS)
    // v13.756.0: sólo cotizaciones vivas. Sin este filtro las cotizaciones
    // eliminadas (soft-delete, `deleted_at != null`) seguían apareciendo en el
    // listado como si nada hubiera pasado.
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    // FE-05: límite explícito defensivo — PostgREST capa en ~1000 filas sin
    // avisar y las cotizaciones más viejas desaparecían del listado.
    // TODO post-freeze: paginación server-side (`embarques/services/paginados.ts`).
    .limit(CAP_POSTGREST);
  if (organizationId) query = query.eq("organization_id", organizationId);
  const data = await unwrap(query);
  // Aplanamos `cotizacion_costos: [{count: N}]` → `cotizacion_costos_count: N`
  // para consumir más cómodo en el listado.
  type RawRow = Record<string, unknown> & {
    cotizacion_costos?: Array<{ count: number }>;
    costeo_tarifas?: { vigente_hasta?: string | null } | null;
  };
  // SAFE-CAST: Supabase tipa la respuesta como filas de la tabla, pero el join
  // `cotizacion_costos(count)` agrega un array virtual que no aparece en el
  // schema generado. Lo aplanamos a `RawRow` para consumir el conteo.
  const flattened = (data as unknown as RawRow[] | null ?? []).map((r) => ({
    ...r,
    cotizacion_costos_count: r.cotizacion_costos?.[0]?.count ?? 0,
    tarifa_vigente_hasta: r.costeo_tarifas?.vigente_hasta ?? null,
  }));
  return fromDbChecked<Array<CotizacionRow & { cotizacion_costos_count: number; tarifa_vigente_hasta: string | null }>>(
    flattened,
    cotizacionRowsDbSchema,
  );

}

// v13.303.23 — Incluimos también `En operación` para que el buscador de
// vinculación en el wizard de editar embarque siga mostrando la cotización
// ya vinculada (que pasa a `En operación` tras crear el embarque).
export async function fetchCotizacionesAceptadas(organizationId: string | null) {
  let query = supabase
    .from("cotizaciones")
    .select(COTIZACION_ACEPTADA_COLUMNS)
    .in("estado", ["Aceptada", "En operación"])
    // v13.756.0: una cotización eliminada no debe poder vincularse a embarques.
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(CAP_POSTGREST); // FE-05: mismo cap defensivo que `fetchCotizaciones`
  if (organizationId) query = query.eq("organization_id", organizationId);
  const data = await unwrap(query);
  return fromDbChecked<CotizacionRow[]>(data, cotizacionRowsDbSchema);
}

export async function fetchCotizacionById(id: string): Promise<CotizacionRow | null> {
  // 13.297.1 — `.maybeSingle()` en lugar de `.single()` para no lanzar
  // PGRST116 cuando la cotización fue borrada o el link está viejo.
  // La UI (`CotizacionDetalle`, `EditarCotizacion`) ya maneja `null`.
  // Fixes Sentry JAVASCRIPT-REACT-1M.
  // v13.756.0: una cotización soft-deleted se trata como inexistente para que
  // no se pueda abrir ni editar desde un link viejo.
  const data = await unwrap(
    supabase.from("cotizaciones").select("*").eq("id", id).is("deleted_at", null).maybeSingle(),
  );
  return data ? fromDbChecked<CotizacionRow>(data, cotizacionRowDbSchema) : null;
}

export async function fetchEmbarquesVinculados(cotizacionId: string) {
  // Sólo embarques vivos: si un embarque fue soft-deleted (deleted_at != null),
  // no debe seguir bloqueando la re-conversión de la cotización.
  return unwrapOr(
    supabase
      .from("embarques")
      .select("id, expediente, estado, created_at")
      .eq("cotizacion_id", cotizacionId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
    [],
  );
}

/** Folio liviano de una cotización (para chips/links en otras vistas). */
export async function fetchCotizacionFolio(cotizacionId: string): Promise<string | null> {
  const data = await unwrap(
    supabase.from("cotizaciones").select("folio").eq("id", cotizacionId).maybeSingle(),
  );
  return (data as { folio: string } | null)?.folio ?? null;
}
