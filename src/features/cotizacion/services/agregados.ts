/**
 * YG-03: agregados server-side del listado de Cotizaciones — KPIs de 30 días,
 * conteos por segmento (tabs) y total de la bandeja "aceptadas sin embarque".
 * Todos resueltos con `count: "exact", head: true` (sin traer filas).
 */
import { supabase } from "@/integrations/supabase/client";
import type { SegmentoCotizacion } from "./cotizacionListTypes";

interface CountableQuery {
  is(col: string, val: null): CountableQuery;
  eq(col: string, val: unknown): CountableQuery;
  gte(col: string, val: unknown): CountableQuery;
  in(col: string, vals: readonly string[]): CountableQuery;
  or(expr: string): CountableQuery;
}

type CountResponse = { count: number | null; error: unknown };

function baseCountQuery(organizationId: string | null): CountableQuery {
  let q = supabase
    .from("cotizaciones")
    // SAFE-CAST: el builder de supabase-js no expone un tipo estructural
    // reutilizable; se estrecha a la interfaz mínima `CountableQuery`.
    .select("id", { count: "exact", head: true }) as unknown as CountableQuery;
  q = q.is("deleted_at", null);
  if (organizationId) q = q.eq("organization_id", organizationId);
  return q;
}

async function count(
  organizationId: string | null,
  apply?: (q: CountableQuery) => CountableQuery,
): Promise<number> {
  let q = baseCountQuery(organizationId);
  if (apply) q = apply(q);
  // SAFE-CAST: `head: true` devuelve sólo count/error; el tipo genérico del
  // builder no lo refleja.
  const { count: n, error } = (await q) as unknown as CountResponse;
  if (error) throw error;
  return n ?? 0;
}

function applySegmento(q: CountableQuery, segmento: SegmentoCotizacion): CountableQuery {
  if (segmento === "prospectos") return q.eq("es_prospecto", true);
  if (segmento === "clientes") return q.or("es_prospecto.is.null,es_prospecto.eq.false");
  return q;
}

export interface CotizacionKpis30d {
  total: number;
  aceptadas: number;
  rechazadas: number;
  tasa: string;
}

export interface CotizacionSegmentoConteos {
  clientes: number;
  prospectos: number;
  todas: number;
}

export interface CotizacionAgregados {
  kpis: CotizacionKpis30d;
  segmentoConteos: CotizacionSegmentoConteos;
  totalAceptadasSinEmbarque: number;
}

async function fetchKpis30d(
  organizationId: string | null,
  segmento: SegmentoCotizacion,
): Promise<CotizacionKpis30d> {
  const hace30Dias = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const conSegmentoY30d = (q: CountableQuery) => applySegmento(q, segmento).gte("created_at", hace30Dias);
  const [total, aceptadas, rechazadas] = await Promise.all([
    count(organizationId, conSegmentoY30d),
    count(organizationId, (q) => conSegmentoY30d(q).in("estado", ["Aceptada", "En operación"])),
    count(organizationId, (q) => conSegmentoY30d(q).eq("estado", "Rechazada")),
  ]);
  const tasa = total > 0 ? ((aceptadas / total) * 100).toFixed(1) : "0.0";
  return { total, aceptadas, rechazadas, tasa };
}

async function fetchSegmentoConteos(organizationId: string | null): Promise<CotizacionSegmentoConteos> {
  const [clientes, prospectos] = await Promise.all([
    count(organizationId, (q) => applySegmento(q, "clientes")),
    count(organizationId, (q) => applySegmento(q, "prospectos")),
  ]);
  return { clientes, prospectos, todas: clientes + prospectos };
}

/** O4.5(a): contador de la bandeja, independiente de los filtros visibles. */
async function fetchTotalAceptadasSinEmbarque(organizationId: string | null): Promise<number> {
  return count(organizationId, (q) => q.eq("estado", "Aceptada").is("embarque_id", null));
}

export async function fetchCotizacionAgregados(
  organizationId: string | null,
  segmento: SegmentoCotizacion,
): Promise<CotizacionAgregados> {
  const [kpis, segmentoConteos, totalAceptadasSinEmbarque] = await Promise.all([
    fetchKpis30d(organizationId, segmento),
    fetchSegmentoConteos(organizationId),
    fetchTotalAceptadasSinEmbarque(organizationId),
  ]);
  return { kpis, segmentoConteos, totalAceptadasSinEmbarque };
}
