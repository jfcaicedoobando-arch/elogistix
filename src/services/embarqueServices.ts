import { supabase } from '@/integrations/supabase/client';
import { uploadFile, deleteFile } from '@/services/storage';
import {
  buildEmbarqueDocPath,
  sanitizeFileName,
  sanitizeStorageKey,
} from '@/lib/storageUtils';
import type {
  Enums,
  Json,
  Tables,
  TablesInsert,
} from '@/integrations/supabase/types';

type EmbarqueRow = Tables<'embarques'>;
type EmbarqueInsert = TablesInsert<'embarques'>;
type ConceptoVentaRow = Tables<'conceptos_venta'>;
type ConceptoCostoRow = Tables<'conceptos_costo'>;
type DocumentoEmbarqueRow = Tables<'documentos_embarque'>;
type NotaEmbarqueRow = Tables<'notas_embarque'>;
type DocumentoEstado = TablesInsert<'documentos_embarque'>['estado'];

// ─── Columnas reutilizables ──────────────────────────────────────────────────

export const EMBARQUE_LIST_COLUMNS =
  'id, expediente, bl_master, cliente_id, cliente_nombre, modo, estado, etd, eta, operador, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, contenedor, tipo_contenedor, descripcion_mercancia, tipo, created_at, tipo_cambio_usd, tipo_cambio_eur, tiene_proforma' as const;

export const EMBARQUE_DETAIL_COLUMNS =
  'id, expediente, bl_master, bl_house, mawb, hawb, carta_porte, cliente_id, cliente_nombre, consignatario, shipper, modo, tipo, estado, etd, eta, fecha_creacion, fecha_llegada_real, operador, agente, naviera, aerolinea, transportista, contenedor, tipo_contenedor, tipo_servicio, tipo_carga, descripcion_mercancia, peso_kg, volumen_m3, piezas, incoterm, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, msds_archivo, organization_id, cotizacion_id, tipo_cambio_usd, tipo_cambio_eur, tiene_proforma, created_at, updated_at' as const;

// ─── Expediente / Documentos en creación ─────────────────────────────────────

export async function resolverExpediente(
  blMaster: string | undefined | null,
  tipoOperacion: string,
): Promise<string> {
  if (blMaster && blMaster.trim()) {
    const { data, error } = await supabase.rpc('resolver_expediente_por_bl', {
      _bl_master: blMaster.trim(),
      _tipo_op: tipoOperacion,
    });
    if (error || !data) {
      throw new Error(error?.message || 'No se pudo resolver el número de referencia.');
    }
    return data;
  }

  const { data, error } = await supabase.rpc('generar_expediente', {
    tipo_op: tipoOperacion,
  });
  if (error || !data) {
    throw new Error(error?.message || 'No se pudo generar el número de referencia.');
  }
  return data;
}

export async function subirDocumentosEmbarque(
  expediente: string,
  documentosChecklist: { nombre: string }[],
  archivos: Record<string, File>,
): Promise<{ nombre: string; archivo?: string }[]> {
  const tareas = documentosChecklist.map(async (doc) => {
    const file = archivos[doc.nombre];
    if (file) {
      const ruta = buildEmbarqueDocPath(expediente, doc.nombre, file.name);
      await uploadFile(ruta, file);
      return { nombre: doc.nombre, archivo: ruta };
    }
    return { nombre: doc.nombre };
  });

  return Promise.all(tareas);
}

// ─── Eventos de tracking ─────────────────────────────────────────────────────

export interface EventoEmbarqueRow {
  id: string;
  embarque_id: string;
  tipo: string;
  descripcion: string;
  ubicacion: string;
  fecha: string;
  usuario: string;
  created_at: string;
}

export async function fetchEventosEmbarque(embarqueId: string): Promise<EventoEmbarqueRow[]> {
  const { data, error } = await supabase
    .from('eventos_embarque')
    .select('*')
    .eq('embarque_id', embarqueId)
    .order('fecha', { ascending: false });
  if (error) throw error;
  return (data ?? []) as EventoEmbarqueRow[];
}

export async function insertEventoEmbarque(input: {
  embarqueId: string;
  tipo: string;
  descripcion: string;
  ubicacion: string;
  fecha: string;
  usuario: string;
}): Promise<void> {
  const { error } = await supabase.from('eventos_embarque').insert([
    {
      embarque_id: input.embarqueId,
      tipo: input.tipo as Enums<'tipo_evento_tracking'>,
      descripcion: input.descripcion,
      ubicacion: input.ubicacion,
      fecha: input.fecha,
      usuario: input.usuario,
    },
  ]);
  if (error) throw error;
}

// ─── Queries principales ─────────────────────────────────────────────────────

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
}

export async function fetchEmbarquesPaginados(
  f: EmbarquesPaginadosFilters,
): Promise<{ data: EmbarqueRow[]; count: number }> {
  let query = supabase
    .from('embarques')
    .select(EMBARQUE_LIST_COLUMNS, { count: 'exact' })
    .order('created_at', { ascending: false });

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

// ─── Mutations ───────────────────────────────────────────────────────────────

export interface CrearEmbarqueRpcInput {
  embarque: TablesInsert<'embarques'>;
  conceptosVenta: Omit<TablesInsert<'conceptos_venta'>, 'embarque_id'>[];
  conceptosCosto: Omit<TablesInsert<'conceptos_costo'>, 'embarque_id'>[];
  documentos: Omit<TablesInsert<'documentos_embarque'>, 'embarque_id'>[];
}

export async function crearEmbarqueRpc(input: CrearEmbarqueRpcInput): Promise<{ id: string }> {
  const { data, error } = await supabase.rpc('crear_embarque_completo', {
    p_embarque: input.embarque as unknown as Json,
    p_conceptos_venta: input.conceptosVenta as unknown as Json,
    p_conceptos_costo: input.conceptosCosto as unknown as Json,
    p_documentos: input.documentos as unknown as Json,
  });
  if (error) throw error;
  return data as unknown as { id: string };
}

export interface ActualizarEmbarqueRpcInput {
  id: string;
  embarque: Partial<TablesInsert<'embarques'>>;
  conceptosVenta: Omit<TablesInsert<'conceptos_venta'>, 'embarque_id'>[];
  conceptosCosto: Omit<TablesInsert<'conceptos_costo'>, 'embarque_id'>[];
}

export async function actualizarEmbarqueRpc(input: ActualizarEmbarqueRpcInput): Promise<void> {
  const { error } = await supabase.rpc('actualizar_embarque_completo', {
    p_embarque_id: input.id,
    p_embarque: input.embarque as unknown as Json,
    p_conceptos_venta: input.conceptosVenta as unknown as Json,
    p_conceptos_costo: input.conceptosCosto as unknown as Json,
  });
  if (error) throw error;
}

export async function duplicarEmbarqueRpc(
  embarqueOrigenId: string,
  copias: Array<{
    num_contenedor: string;
    tipo_contenedor: string;
    peso_kg: number;
    volumen_m3: number;
    piezas: number;
  }>,
): Promise<{ id: string; expediente: string }[]> {
  const { data, error } = await supabase.rpc('duplicar_embarque_completo', {
    p_embarque_origen_id: embarqueOrigenId,
    p_copias: copias as unknown as Json,
  });
  if (error) throw error;
  return data as unknown as { id: string; expediente: string }[];
}

export async function eliminarEmbarqueRpc(embarqueId: string): Promise<void> {
  const { error } = await supabase.rpc('eliminar_embarque_completo', {
    p_embarque_id: embarqueId,
  });
  if (error) throw error;
}

export async function actualizarEstadoEmbarque(embarqueId: string, estado: string): Promise<void> {
  const { error } = await supabase
    .from('embarques')
    .update({ estado: estado as EmbarqueInsert['estado'] })
    .eq('id', embarqueId);
  if (error) throw error;
}

export async function insertarNotaCambioEstado(
  embarqueId: string,
  contenido: string,
  usuarioEmail: string,
): Promise<void> {
  const { error } = await supabase.from('notas_embarque').insert({
    embarque_id: embarqueId,
    contenido,
    tipo: 'cambio_estado' as const,
    usuario: usuarioEmail,
  });
  if (error) throw error;
}

export async function insertarNotaEmbarque(
  embarqueId: string,
  contenido: string,
  usuario: string,
): Promise<void> {
  const { error } = await supabase.from('notas_embarque').insert({
    embarque_id: embarqueId,
    contenido,
    tipo: 'nota' as const,
    usuario,
  });
  if (error) throw error;
}

export async function uploadDocumentoEmbarque(
  embarqueId: string,
  docId: string,
  file: File,
): Promise<{ path: string; fileName: string }> {
  const path = `embarques/${sanitizeStorageKey(embarqueId)}/${sanitizeStorageKey(docId)}/${sanitizeFileName(file.name)}`;
  await uploadFile(path, file);
  const { error } = await supabase
    .from('documentos_embarque')
    .update({ archivo: path, estado: 'Recibido' as DocumentoEstado })
    .eq('id', docId);
  if (error) throw error;
  return { path, fileName: file.name };
}

export async function deleteDocumentoEmbarque(docId: string, archivoPath: string): Promise<void> {
  await deleteFile(archivoPath);
  const { error } = await supabase.from('documentos_embarque').delete().eq('id', docId);
  if (error) throw error;
}
