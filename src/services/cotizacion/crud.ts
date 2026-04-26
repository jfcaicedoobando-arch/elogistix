/**
 * Cotizaciones — CRUD y lecturas básicas (cotizaciones, queries de listado y detalle).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json, TablesInsert } from "@/integrations/supabase/types";
import type { CotizacionRow, CreateCotizacionInput } from "@/types/cotizacion";

type CotizacionInsert = TablesInsert<"cotizaciones">;
type CotizacionUpdate = Partial<CotizacionInsert>;

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
  return data as unknown as CotizacionRow[];
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
  return data as unknown as CotizacionRow[];
}

export const COTIZACION_DETAIL_COLUMNS =
  "id, folio, organization_id, cliente_id, cliente_nombre, es_prospecto, prospecto_empresa, prospecto_contacto, prospecto_email, prospecto_telefono, modo, tipo, incoterm, descripcion_mercancia, peso_kg, volumen_m3, piezas, origen, destino, conceptos_venta, subtotal, moneda, vigencia_dias, fecha_vigencia, notas, operador, tipo_carga, msds_archivo, tipo_embarque, tipo_contenedor, tipo_peso, descripcion_adicional, sector_economico, dimensiones_lcl, dimensiones_aereas, dias_libres_destino, dias_almacenaje, tiempo_transito_dias, frecuencia, ruta_texto, validez_propuesta, tipo_movimiento, seguro, valor_seguro_usd, carta_garantia, num_contenedores, estado, embarque_id, created_at, updated_at" as const;

export async function fetchCotizacionById(id: string): Promise<CotizacionRow> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select(COTIZACION_DETAIL_COLUMNS)
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as CotizacionRow;
}

// ─── Listado paginado server-side (filtros + búsqueda + count) ─────────────
export interface CotizacionesPaginadasFilters {
  organizationId: string | null;
  search: string;
  filterEstado: string;
  filterCliente: string;
  page: number;
  pageSize: number;
}

export async function fetchCotizacionesPaginadas(
  f: CotizacionesPaginadasFilters,
): Promise<{ data: CotizacionRow[]; count: number }> {
  let query = supabase
    .from("cotizaciones")
    .select(COTIZACION_LIST_COLUMNS, { count: "exact" })
    .order("created_at", { ascending: false });

  if (f.organizationId) query = query.eq("organization_id", f.organizationId);
  if (f.filterEstado !== "todos") {
    query = query.eq("estado", f.filterEstado as CotizacionInsert["estado"]);
  }
  if (f.filterCliente !== "todos") query = query.eq("cliente_id", f.filterCliente);
  if (f.search) {
    query = query.or(
      `folio.ilike.%${f.search}%,cliente_nombre.ilike.%${f.search}%,descripcion_mercancia.ilike.%${f.search}%`,
    );
  }

  const from = f.page * f.pageSize;
  const to = from + f.pageSize - 1;
  query = query.range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  return { data: (data ?? []) as unknown as CotizacionRow[], count: count ?? 0 };
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

// ─── Mutations CRUD ─────────────────────────────────────────────────────────
export async function crearCotizacion(input: CreateCotizacionInput): Promise<CotizacionRow> {
  const folio = await generarFolioCotizacion();
  const fechaVigencia = new Date();
  fechaVigencia.setDate(fechaVigencia.getDate() + input.vigencia_dias);

  const insertPayload: CotizacionInsert = {
    folio,
    cliente_id: input.es_prospecto ? null : input.cliente_id,
    cliente_nombre: input.cliente_nombre,
    es_prospecto: input.es_prospecto,
    prospecto_empresa: input.prospecto_empresa || "",
    prospecto_contacto: input.prospecto_contacto || "",
    prospecto_email: input.prospecto_email || "",
    prospecto_telefono: input.prospecto_telefono || "",
    modo: input.modo as CotizacionInsert["modo"],
    tipo: input.tipo as CotizacionInsert["tipo"],
    incoterm: input.incoterm as CotizacionInsert["incoterm"],
    descripcion_mercancia: input.descripcion_mercancia,
    peso_kg: input.peso_kg,
    volumen_m3: input.volumen_m3,
    piezas: input.piezas,
    origen: input.origen,
    destino: input.destino,
    conceptos_venta: input.conceptos_venta as unknown as Json,
    subtotal: input.subtotal,
    moneda: input.moneda as CotizacionInsert["moneda"],
    vigencia_dias: input.vigencia_dias,
    fecha_vigencia: fechaVigencia.toISOString().split("T")[0],
    notas: input.notas || null,
    operador: input.operador,
    tipo_carga: input.tipo_carga || "Carga General",
    msds_archivo: input.msds_archivo || null,
    tipo_embarque: input.tipo_embarque || "FCL",
    tipo_contenedor: input.tipo_contenedor || null,
    tipo_peso: input.tipo_peso || "Peso Normal",
    descripcion_adicional: input.descripcion_adicional || "",
    sector_economico: input.sector_economico || "",
    dimensiones_lcl: (input.dimensiones_lcl || []) as unknown as Json,
    dimensiones_aereas: (input.dimensiones_aereas || []) as unknown as Json,
    dias_libres_destino: input.dias_libres_destino ?? 0,
    dias_almacenaje: input.dias_almacenaje ?? 0,
    tiempo_transito_dias: input.tiempo_transito_dias ?? null,
    frecuencia: input.frecuencia || "",
    ruta_texto: input.ruta_texto || "",
    validez_propuesta: input.validez_propuesta ?? null,
    tipo_movimiento: input.tipo_movimiento || "",
    seguro: input.seguro ?? false,
    valor_seguro_usd: input.valor_seguro_usd ?? 0,
    carta_garantia: input.carta_garantia ?? false,
    num_contenedores: input.num_contenedores ?? 1,
  };

  const { data, error } = await supabase
    .from("cotizaciones")
    .insert(insertPayload)
    .select()
    .single();
  if (error) throw error;
  return data as unknown as CotizacionRow;
}

export async function updateCotizacion(
  id: string,
  data: Partial<CreateCotizacionInput>,
): Promise<void> {
  const updatePayload = { ...data } as unknown as CotizacionUpdate;
  if (data.conceptos_venta) updatePayload.conceptos_venta = data.conceptos_venta as unknown as Json;
  if (data.dimensiones_lcl) updatePayload.dimensiones_lcl = data.dimensiones_lcl as unknown as Json;
  if (data.dimensiones_aereas)
    updatePayload.dimensiones_aereas = data.dimensiones_aereas as unknown as Json;
  if (data.modo) updatePayload.modo = data.modo as CotizacionInsert["modo"];
  if (data.tipo) updatePayload.tipo = data.tipo as CotizacionInsert["tipo"];
  if (data.incoterm) updatePayload.incoterm = data.incoterm as CotizacionInsert["incoterm"];
  if (data.moneda) updatePayload.moneda = data.moneda as CotizacionInsert["moneda"];
  const { error } = await supabase.from("cotizaciones").update(updatePayload).eq("id", id);
  if (error) throw error;
}

export async function deleteCotizacion(id: string): Promise<void> {
  const { error } = await supabase.from("cotizaciones").delete().eq("id", id);
  if (error) throw error;
}

export async function updateEstadoCotizacion(id: string, estado: string): Promise<void> {
  const { error } = await supabase
    .from("cotizaciones")
    .update({ estado: estado as CotizacionInsert["estado"] })
    .eq("id", id);
  if (error) throw error;
}
