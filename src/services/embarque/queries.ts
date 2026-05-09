import { supabase } from '@/integrations/supabase/client';
import type { Tables, TablesInsert } from '@/integrations/supabase/types';
import { EMBARQUE_LIST_COLUMNS, EMBARQUE_DETAIL_COLUMNS } from './columns';

type EmbarqueRow = Tables<'embarques'>;
type ConceptoVentaRow = Tables<'conceptos_venta'>;
type ConceptoCostoRow = Tables<'conceptos_costo'>;
type DocumentoEmbarqueRow = Tables<'documentos_embarque'>;
type NotaEmbarqueRow = Tables<'notas_embarque'>;

export async function fetchEmbarques(organizationId: string | null): Promise<EmbarqueRow[]> {
  let query = supabase
    .from('embarques')
    .select(EMBARQUE_LIST_COLUMNS)
    .order('created_at', { ascending: false });
  if (organizationId) query = query.eq('organization_id', organizationId);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as EmbarqueRow[];
}

/**
 * Whitelist de columnas server-side ordenables. Evita inyección y garantiza
 * que la columna existe en `embarques`. Las claves del UI se mapean a estos
 * campos reales de DB en `SORT_KEY_TO_COLUMN`.
 */
export const SORTABLE_EMBARQUE_COLUMNS = [
  'created_at', 'expediente', 'cliente_nombre', 'modo', 'estado', 'etd', 'eta', 'operador',
] as const;
export type SortableEmbarqueColumn = typeof SORTABLE_EMBARQUE_COLUMNS[number];

export const SORT_KEY_TO_COLUMN: Record<string, SortableEmbarqueColumn> = {
  expediente: 'expediente',
  cliente: 'cliente_nombre',
  modo: 'modo',
  estado: 'estado',
  etd: 'etd',
  eta: 'eta',
  operador: 'operador',
  created_at: 'created_at',
};

export interface EmbarquesPaginadosFilters {
  organizationId: string | null;
  search: string;
  filterModo: string;
  filterCliente: string;
  filterOperador: string;
  filterProforma: string;
  fechaDesde?: string;
  fechaHasta?: string;
  page: number;
  pageSize: number;
  sortBy?: SortableEmbarqueColumn;
  sortDir?: 'asc' | 'desc';
}

export async function fetchEmbarquesPaginados(
  f: EmbarquesPaginadosFilters,
): Promise<{ data: EmbarqueRow[]; count: number }> {
  const sortCol: SortableEmbarqueColumn = SORTABLE_EMBARQUE_COLUMNS.includes(f.sortBy as SortableEmbarqueColumn)
    ? (f.sortBy as SortableEmbarqueColumn)
    : 'created_at';
  const ascending = f.sortDir === 'asc';

  let query = supabase
    .from('embarques')
    .select(EMBARQUE_LIST_COLUMNS, { count: 'estimated' })
    .order(sortCol, { ascending, nullsFirst: false });

  // Tiebreaker estable cuando el orden principal puede repetirse
  // (p.ej. expediente duplicado en LCL: un registro por contenedor).
  if (sortCol !== 'created_at') {
    query = query.order('created_at', { ascending: false });
  }

  if (f.organizationId) query = query.eq('organization_id', f.organizationId);

  if (f.search) {
    query = query.or(
      `expediente.ilike.%${f.search}%,cliente_nombre.ilike.%${f.search}%,descripcion_mercancia.ilike.%${f.search}%,bl_master.ilike.%${f.search}%`,
    );
  }
  if (f.filterModo !== 'todos') {
    query = query.eq('modo', f.filterModo as TablesInsert<'embarques'>['modo']);
  }
  if (f.filterCliente !== 'todos') query = query.eq('cliente_id', f.filterCliente);
  if (f.filterOperador !== 'todos') query = query.eq('operador', f.filterOperador);
  if (f.filterProforma === 'con') query = query.eq('tiene_proforma', true);
  else if (f.filterProforma === 'sin') query = query.eq('tiene_proforma', false);
  if (f.fechaDesde) query = query.gte('etd', f.fechaDesde);
  if (f.fechaHasta) query = query.lte('eta', f.fechaHasta);

  const from = f.page * f.pageSize;
  const to = from + f.pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data ?? []) as EmbarqueRow[], count: count ?? 0 };
}

/**
 * Trae TODOS los embarques que cumplen los filtros (sin paginar).
 * Usa paginación interna en chunks de 1000 para superar el límite default de Supabase.
 * Pensado para exportar a CSV el resultado completo del filtro actual.
 */
export type EmbarquesParaExportFilters = Omit<EmbarquesPaginadosFilters, 'page' | 'pageSize' | 'sortBy' | 'sortDir'>;

export async function fetchEmbarquesParaExport(
  f: EmbarquesParaExportFilters,
): Promise<EmbarqueRow[]> {
  const PAGE = 1000;
  const all: EmbarqueRow[] = [];
  let from = 0;

  while (true) {
    let query = supabase
      .from('embarques')
      .select(EMBARQUE_LIST_COLUMNS)
      .order('created_at', { ascending: false })
      .range(from, from + PAGE - 1);

    if (f.organizationId) query = query.eq('organization_id', f.organizationId);
    if (f.search) {
      query = query.or(
        `expediente.ilike.%${f.search}%,cliente_nombre.ilike.%${f.search}%,descripcion_mercancia.ilike.%${f.search}%,bl_master.ilike.%${f.search}%`,
      );
    }
    if (f.filterModo !== 'todos') {
      query = query.eq('modo', f.filterModo as TablesInsert<'embarques'>['modo']);
    }
    if (f.filterCliente !== 'todos') query = query.eq('cliente_id', f.filterCliente);
    if (f.filterOperador !== 'todos') query = query.eq('operador', f.filterOperador);
    if (f.filterProforma === 'con') query = query.eq('tiene_proforma', true);
    else if (f.filterProforma === 'sin') query = query.eq('tiene_proforma', false);
    if (f.fechaDesde) query = query.gte('etd', f.fechaDesde);
    if (f.fechaHasta) query = query.lte('eta', f.fechaHasta);

    const { data, error } = await query;
    if (error) throw error;
    const batch = (data ?? []) as EmbarqueRow[];
    all.push(...batch);
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

export async function fetchEmbarqueById(id: string): Promise<EmbarqueRow> {
  const { data, error } = await supabase
    .from('embarques')
    .select(EMBARQUE_DETAIL_COLUMNS)
    .eq('id', id)
    .single();
  if (error) throw error;
  return data as EmbarqueRow;
}

export async function fetchEmbarqueConceptosVenta(embarqueId: string): Promise<ConceptoVentaRow[]> {
  const { data, error } = await supabase
    .from('conceptos_venta')
    .select(
      'id, embarque_id, descripcion, cantidad, precio_unitario, total, moneda, organization_id, created_at, estado_facturacion, proforma_id, aplica_iva',
    )
    .eq('embarque_id', embarqueId);
  if (error) throw error;
  return (data ?? []) as ConceptoVentaRow[];
}

export async function fetchEmbarqueConceptosCosto(embarqueId: string): Promise<ConceptoCostoRow[]> {
  const { data, error } = await supabase
    .from('conceptos_costo')
    .select(
      'id, embarque_id, concepto, monto, moneda, proveedor_id, proveedor_nombre, estado_liquidacion, fecha_pago, fecha_vencimiento, referencia_pago, organization_id, created_at',
    )
    .eq('embarque_id', embarqueId);
  if (error) throw error;
  return (data ?? []) as ConceptoCostoRow[];
}

export async function fetchEmbarqueDocumentos(embarqueId: string): Promise<DocumentoEmbarqueRow[]> {
  const { data, error } = await supabase
    .from('documentos_embarque')
    .select('id, embarque_id, nombre, archivo, estado, notas, organization_id, created_at')
    .eq('embarque_id', embarqueId);
  if (error) throw error;
  return (data ?? []) as DocumentoEmbarqueRow[];
}

export async function fetchEmbarqueNotas(embarqueId: string): Promise<NotaEmbarqueRow[]> {
  const { data, error } = await supabase
    .from('notas_embarque')
    .select('id, embarque_id, contenido, tipo, fecha, usuario, organization_id, created_at')
    .eq('embarque_id', embarqueId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []) as NotaEmbarqueRow[];
}

export async function fetchEmbarqueFacturas(embarqueId: string) {
  const { data, error } = await supabase
    .from('facturas')
    .select(
      'id, numero, embarque_id, expediente, cliente_id, cliente_nombre, estado, moneda, subtotal, iva, total, tipo_cambio, fecha_emision, fecha_vencimiento, referencia_bl, notas, organization_id, created_at, updated_at, proforma_id, factura_pdf_url, factura_xml_url',
    )
    .eq('embarque_id', embarqueId);
  if (error) throw error;
  return data ?? [];
}

export interface ExpedienteCliente {
  expediente: string;
  bl_master: string | null;
  cliente_nombre: string;
  total_embarques: number;
}

export async function fetchExpedientesCliente(clienteId: string): Promise<ExpedienteCliente[]> {
  const { data, error } = await supabase
    .from('embarques')
    .select('expediente, bl_master, cliente_nombre')
    .eq('cliente_id', clienteId)
    .neq('estado', 'Cerrado')
    .order('created_at', { ascending: false });
  if (error) throw error;
  const map = new Map<string, ExpedienteCliente>();
  for (const row of data ?? []) {
    const existing = map.get(row.expediente);
    if (existing) {
      existing.total_embarques++;
    } else {
      map.set(row.expediente, {
        expediente: row.expediente,
        bl_master: row.bl_master,
        cliente_nombre: row.cliente_nombre,
        total_embarques: 1,
      });
    }
  }
  return Array.from(map.values());
}

export async function fetchProveedoresForSelect(organizationId: string | null) {
  let query = supabase.from('proveedores').select('id, nombre').order('nombre');
  if (organizationId) query = query.eq('organization_id', organizationId);
  const { data, error } = await query;
  if (error) throw error;
  return data ?? [];
}

export async function fetchEmbarquesRelacionados(embarqueId: string, blMaster: string) {
  const { data, error } = await supabase
    .from('embarques')
    .select('id, expediente, bl_house, cliente_nombre, shipper, estado')
    .eq('bl_master', blMaster)
    .neq('id', embarqueId);
  if (error) throw error;
  return data ?? [];
}

export interface EmbarqueListExtras {
  liquidacion: Record<string, { total: number; pagados: number }>;
  docs: Record<string, { total: number; pendientes: number }>;
}

export async function fetchEmbarquesListExtras(ids: string[]): Promise<EmbarqueListExtras> {
  if (ids.length === 0) return { liquidacion: {}, docs: {} };
  const { data, error } = await supabase.rpc('embarques_list_extras', { p_ids: ids });
  if (error) throw error;

  const liquidacion: EmbarqueListExtras['liquidacion'] = {};
  const docs: EmbarqueListExtras['docs'] = {};
  (data ?? []).forEach(
    (row: {
      embarque_id: string;
      costos_total: number;
      costos_pagados: number;
      docs_total: number;
      docs_pendientes: number;
    }) => {
      liquidacion[row.embarque_id] = {
        total: Number(row.costos_total),
        pagados: Number(row.costos_pagados),
      };
      docs[row.embarque_id] = {
        total: Number(row.docs_total),
        pendientes: Number(row.docs_pendientes),
      };
    },
  );
  return { liquidacion, docs };
}

// ── Embarque "full" (RPC get_embarque_full) ─────────────────────────────
export interface EmbarqueFullData {
  embarque: EmbarqueRow | null;
  conceptosVenta: ConceptoVentaRow[];
  conceptosCosto: ConceptoCostoRow[];
  documentos: DocumentoEmbarqueRow[];
  notas: NotaEmbarqueRow[];
  facturas: Tables<'facturas'>[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function fetchEmbarqueFull(idOrExpediente: string): Promise<EmbarqueFullData | null> {
  let id = idOrExpediente;
  // Si no es UUID, asumimos que es expediente (folio human-readable). Resolvemos a id.
  if (!UUID_RE.test(idOrExpediente)) {
    const { data: row, error: lookupErr } = await supabase
      .from('embarques')
      .select('id')
      .eq('expediente', idOrExpediente)
      .maybeSingle();
    if (lookupErr) throw lookupErr;
    if (!row) return null;
    id = row.id;
  }
  const { data, error } = await supabase.rpc('get_embarque_full', { p_embarque_id: id });
  if (error) throw error;
  if (!data) return null;
  const payload = data as {
    embarque: EmbarqueRow | null;
    conceptosVenta: ConceptoVentaRow[] | null;
    conceptosCosto: ConceptoCostoRow[] | null;
    documentos: DocumentoEmbarqueRow[] | null;
    notas: NotaEmbarqueRow[] | null;
    facturas: Tables<'facturas'>[] | null;
  };
  return {
    embarque: payload.embarque ?? null,
    conceptosVenta: payload.conceptosVenta ?? [],
    conceptosCosto: payload.conceptosCosto ?? [],
    documentos: payload.documentos ?? [],
    notas: payload.notas ?? [],
    facturas: payload.facturas ?? [],
  };
}
