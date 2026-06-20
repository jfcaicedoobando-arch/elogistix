/**
 * Cotizaciones — Lecturas (listado, detalle, embarques vinculados, folio).
 */
import { supabase } from "@/integrations/supabase/client";
import type { CotizacionRow } from "@/features/cotizacion/types";
import { fromDb } from "@/lib/supabase/cast";

// ─── Columnas reutilizables ─────────────────────────────────────────────────
// `cotizacion_costos(count)` agrega el conteo de filas relacionadas, que
// usamos para decidir si una cotización tiene costos cargados o sigue
// "Sin costos" (v13.29.0).
export const COTIZACION_LIST_COLUMNS =
  "id, folio, cliente_id, cliente_nombre, modo, origen, destino, subtotal, moneda, estado, fecha_vigencia, created_at, descripcion_mercancia, tipo_documento, vigencia_desde, vigencia_hasta, sin_desglose_costos, estado_revalidacion, tarifa_id, cotizacion_costos(count), costeo_tarifas:tarifa_id(vigente_hasta)" as const;

export const COTIZACION_ACEPTADA_COLUMNS =
  "id, folio, cliente_id, cliente_nombre, modo, tipo, incoterm, descripcion_mercancia, tipo_carga, tipo_contenedor, peso_kg, volumen_m3, piezas, operador, origen, destino, notas" as const;

// ─── Folio helper ───────────────────────────────────────────────────────────
export async function generarFolioCotizacion(): Promise<string> {
  const anio = new Date().getFullYear();
  const prefijo = `COT-${anio}-`;
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("folio")
    .like("folio", `${prefijo}%`)
    .order("folio", { ascending: false })
    .limit(1);
  if (error) throw error;
  let siguiente = 1;
  if (data && data.length > 0) {
    const numero = parseInt(data[0].folio.replace(prefijo, ""), 10);
    if (!isNaN(numero)) siguiente = numero + 1;
  }
  return `${prefijo}${String(siguiente).padStart(4, "0")}`;
}

// ─── Queries ────────────────────────────────────────────────────────────────
export async function fetchCotizaciones(organizationId: string | null) {
  let query = supabase
    .from("cotizaciones")
    .select(COTIZACION_LIST_COLUMNS)
    .order("created_at", { ascending: false });
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) throw error;
  // Aplanamos `cotizacion_costos: [{count: N}]` → `cotizacion_costos_count: N`
  // para consumir más cómodo en el listado.
  type RawRow = Record<string, unknown> & { cotizacion_costos?: Array<{ count: number }> };
  // SAFE-CAST: Supabase tipa la respuesta como filas de la tabla, pero el join
  // `cotizacion_costos(count)` agrega un array virtual que no aparece en el
  // schema generado. Lo aplanamos a `RawRow` para consumir el conteo.
  const flattened = (data as unknown as RawRow[] | null ?? []).map((r) => ({
    ...r,
    cotizacion_costos_count: r.cotizacion_costos?.[0]?.count ?? 0,
  }));
  return fromDb<Array<CotizacionRow & { cotizacion_costos_count: number }>>(flattened);
}

export async function fetchCotizacionesAceptadas(organizationId: string | null) {
  let query = supabase
    .from("cotizaciones")
    .select(COTIZACION_ACEPTADA_COLUMNS)
    .eq("estado", "Aceptada")
    .order("created_at", { ascending: false });
  if (organizationId) query = query.eq("organization_id", organizationId);
  const { data, error } = await query;
  if (error) throw error;
  return fromDb<CotizacionRow[]>(data);
}

export async function fetchCotizacionById(id: string): Promise<CotizacionRow> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return fromDb<CotizacionRow>(data);
}

export async function fetchEmbarquesVinculados(cotizacionId: string) {
  const { data, error } = await supabase
    .from("embarques")
    .select("id, expediente, estado, created_at")
    .eq("cotizacion_id", cotizacionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

/** Folio liviano de una cotización (para chips/links en otras vistas). */
export async function fetchCotizacionFolio(cotizacionId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("folio")
    .eq("id", cotizacionId)
    .maybeSingle();
  if (error) throw error;
  return data?.folio ?? null;
}

