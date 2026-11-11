/**
 * Queries de detalle de las bandejas de trabajo del cockpit de Facturación.
 * Extraído de bandejas.ts para respetar el límite de líneas.
 *
 * v13.823.232: se retiró la bandeja "Por enviar" (y sus helpers de
 * anti-join contra `factura_envios`); el envío por correo sigue
 * disponible desde el detalle de la factura.
 */
import { supabase } from "@/integrations/supabase/client";
import { FECHA_INICIO_TIMBRADO_SISTEMA } from "@/features/facturacion/domain/facturaFlags";
import { warnIfTruncated } from "@/lib/supabase/assertNotTruncated";
import { escapeIlike, orIlike } from "@/lib/search/ilike";

const LIMITE_POR_TIMBRAR = 500;

export interface FilaPorTimbrar {
  id: string;
  numero: string;
  cliente_nombre: string;
  total: number;
  moneda: string;
  fecha_emision: string;
}


export interface FilaRepPendiente {
  id: string;
  factura_id: string;
  factura_numero: string;
  cliente_nombre: string;
  fecha_pago: string;
  monto: number;
  moneda: string;
  estado_rep: string;
}

export async function fetchFacturasPorTimbrar(orgId: string): Promise<FilaPorTimbrar[]> {
  const { data, error } = await supabase
    .from("facturas")
    .select("id, numero, cliente_nombre, total, moneda, fecha_emision")
    .eq("organization_id", orgId)
    .eq("estado", "Borrador")
    .is("facturapi_id", null)
    .is("deleted_at", null)
    .gte("fecha_emision", FECHA_INICIO_TIMBRADO_SISTEMA.slice(0, 10))
    .order("fecha_emision", { ascending: false })
    .limit(LIMITE_POR_TIMBRAR);
  if (error) throw error;
  warnIfTruncated(data, LIMITE_POR_TIMBRAR, "facturacion.fetchFacturasPorTimbrar");
  return (data ?? []) as FilaPorTimbrar[];
}


const SORT_REP_PENDIENTES = {
  factura: "facturas(numero)",
  cliente: "facturas(cliente_nombre)",
  fecha_pago: "fecha_pago",
  monto: "monto",
  estado: "estado_rep",
} as const;

export const REP_PENDIENTES_SORT_KEYS = Object.keys(SORT_REP_PENDIENTES);

export interface RepPendientesFilters extends Record<string, string> {
  estado: string;
}

interface RepPendientesPageParams {
  search: string;
  filters: RepPendientesFilters;
  dateFrom: string;
  dateTo: string;
  sortKey: string | null;
  sortDir: "asc" | "desc";
  range: { from: number; to: number };
}

export async function fetchPagosRepPendientes(
  orgId: string,
  { search, filters, dateFrom, dateTo, sortKey, sortDir, range }: RepPendientesPageParams,
): Promise<{ rows: FilaRepPendiente[]; count: number }> {
  let query = supabase
    .from("pagos_factura")
    .select("id, factura_id, fecha_pago, monto, moneda, estado_rep, facturas!inner(numero, cliente_nombre)", { count: "exact" })
    .eq("organization_id", orgId)
    .in("estado_rep", ["Pendiente", "Error"])
    .is("deleted_at", null);

  if (filters.estado === "Pendiente" || filters.estado === "Error") query = query.eq("estado_rep", filters.estado);
  if (search.trim()) query = query.or(orIlike(["numero", "cliente_nombre"], search), { referencedTable: "facturas" });
  if (dateFrom) query = query.gte("fecha_pago", dateFrom);
  if (dateTo) query = query.lte("fecha_pago", dateTo);
  const column = sortKey && Object.hasOwn(SORT_REP_PENDIENTES, sortKey)
    ? SORT_REP_PENDIENTES[sortKey as keyof typeof SORT_REP_PENDIENTES]
    : SORT_REP_PENDIENTES.fecha_pago;
  const { data, count, error } = await query
    .order(column, { ascending: sortDir === "asc" })
    .order("id", { ascending: true })
    .range(range.from, range.to);
  if (error) throw error;
  if (count === null) throw new Error("La bandeja REP no recibió el total filtrado.");
  type Row = {
    id: string; factura_id: string; fecha_pago: string;
    monto: number; moneda: string; estado_rep: string;
    facturas: { numero: string; cliente_nombre: string } | null;
  };
  const rows = ((data ?? []) as Row[]).map((r) => ({
    id: r.id,
    factura_id: r.factura_id,
    factura_numero: r.facturas?.numero ?? "—",
    cliente_nombre: r.facturas?.cliente_nombre ?? "—",
    fecha_pago: r.fecha_pago,
    monto: r.monto,
    moneda: r.moneda,
    estado_rep: r.estado_rep,
  }));
  return { rows, count };
}

export interface FilaRepHistorico {
  id: string;
  factura_id: string;
  factura_numero: string;
  cliente_nombre: string;
  fecha_pago: string;
  monto: number;
  moneda: string;
  folio_rep: string;
  uuid_rep: string | null;
  timbrado_rep_en: string | null;
  rep_cancellation_status: string | null;
}

const SORT_REP_HISTORICO = {
  folio_rep: "folio_rep",
  factura: "factura_numero",
  cliente: "cliente_nombre",
  fecha_pago: "fecha_pago",
  monto: "monto",
  timbrado: "timbrado_rep_en",
  estado: "estado_visible",
} as const;
export const REP_HISTORICO_SORT_KEYS = Object.keys(SORT_REP_HISTORICO);

export async function fetchRepsHistorico(
  orgId: string,
  { search, sortKey, sortDir, range }: Pick<RepPendientesPageParams, "search" | "sortKey" | "sortDir" | "range">,
): Promise<{ rows: FilaRepHistorico[]; count: number }> {
  let query = supabase.from("v_reps_historico")
    .select("id, factura_id, factura_numero, cliente_nombre, fecha_pago, monto, moneda, folio_rep, uuid_rep, timbrado_rep_en, rep_cancellation_status", { count: "exact" })
    .eq("organization_id", orgId)
  const term = search.trim();
  if (term) query = query.ilike("busqueda", `%${escapeIlike(term)}%`);
  const sort = sortKey && Object.hasOwn(SORT_REP_HISTORICO, sortKey)
    ? SORT_REP_HISTORICO[sortKey as keyof typeof SORT_REP_HISTORICO]
    : SORT_REP_HISTORICO.timbrado;
  const asc = sortDir === "asc";
  const { data, count, error } = await query
    .order(sort, { ascending: asc, nullsFirst: asc })
    .order("id", { ascending: true })
    .range(range.from, range.to);
  if (error) throw error;
  if (count === null) throw new Error("La bandeja de REPs históricos no recibió el total filtrado.");
  return { rows: (data ?? []) as FilaRepHistorico[], count };
}
