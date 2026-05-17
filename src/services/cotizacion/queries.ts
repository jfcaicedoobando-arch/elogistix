/**
 * Cotizaciones — Lecturas (listado, detalle, embarques vinculados, folio).
 */
import { supabase } from "@/integrations/supabase/client";
import type { CotizacionRow } from "@/types/cotizacion";
import { fromDb } from "@/lib/supabase/cast";

// ─── Columnas reutilizables ─────────────────────────────────────────────────
export const COTIZACION_LIST_COLUMNS =
  "id, folio, cliente_id, cliente_nombre, modo, origen, destino, subtotal, moneda, estado, fecha_vigencia, created_at, descripcion_mercancia" as const;

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
  return fromDb<CotizacionRow[]>(data);
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

// ─── Listado paginado (RPC `cotizaciones_listado`) ────────────────────────────
// Bloque 2.4 — agregados embarques_vinculados + paginación server-side.
export interface CotizacionListadoItem {
  id: string;
  folio: string;
  cliente_id: string | null;
  cliente_nombre: string;
  modo: string;
  origen: string;
  destino: string;
  subtotal: number;
  moneda: string;
  estado: string;
  fecha_vigencia: string | null;
  created_at: string;
  descripcion_mercancia: string;
  embarques_vinculados: number;
}

export interface FetchCotizacionesListadoParams {
  organizationId: string | null;
  search?: string;
  estado?: string;
  modo?: string;
  clienteId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  page: number;
  pageSize: number;
}

export async function fetchCotizacionesListado(
  params: FetchCotizacionesListadoParams,
): Promise<{ data: CotizacionListadoItem[]; count: number }> {
  const offset = params.page * params.pageSize;
  const { data, error } = await supabase.rpc("cotizaciones_listado", {
    p_organization_id: params.organizationId ?? undefined,
    p_search: params.search || undefined,
    p_estado: params.estado && params.estado !== "todos" ? params.estado : undefined,
    p_modo: params.modo && params.modo !== "todos" ? params.modo : undefined,
    p_cliente_id: params.clienteId && params.clienteId !== "todos" ? params.clienteId : undefined,
    p_fecha_desde: params.fechaDesde || undefined,
    p_fecha_hasta: params.fechaHasta || undefined,
    p_offset: offset,
    p_limit: params.pageSize,
  });
  if (error) throw error;

  const rows = (data ?? []) as Array<CotizacionListadoItem & { total_count: number | string }>;
  const count = rows.length > 0 ? Number(rows[0].total_count) : 0;
  const mapped: CotizacionListadoItem[] = rows.map((r) => ({
    id: r.id,
    folio: r.folio,
    cliente_id: r.cliente_id,
    cliente_nombre: r.cliente_nombre,
    modo: r.modo,
    origen: r.origen,
    destino: r.destino,
    subtotal: Number(r.subtotal),
    moneda: r.moneda,
    estado: r.estado,
    fecha_vigencia: r.fecha_vigencia,
    created_at: r.created_at,
    descripcion_mercancia: r.descripcion_mercancia,
    embarques_vinculados: Number(r.embarques_vinculados),
  }));
  return { data: mapped, count };
}
