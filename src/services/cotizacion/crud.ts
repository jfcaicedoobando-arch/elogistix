/**
 * Cotizaciones — CRUD y lecturas básicas (cotizaciones, queries de listado y detalle).
 */
import { supabase } from "@/integrations/supabase/client";
import type { Json, TablesInsert } from "@/integrations/supabase/types";
import type { CotizacionRow, CreateCotizacionInput } from "@/types/cotizacion";
import { fromDb, toDbJson } from "@/lib/supabase/cast";

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
    conceptos_venta: toDbJson(input.conceptos_venta),
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
    dimensiones_lcl: toDbJson(input.dimensiones_lcl || []),
    dimensiones_aereas: toDbJson(input.dimensiones_aereas || []),
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
  return fromDb<CotizacionRow>(data);
}

export async function updateCotizacion(
  id: string,
  data: Partial<CreateCotizacionInput>,
): Promise<void> {
  const updatePayload = { ...data } as unknown as CotizacionUpdate;
  if (data.conceptos_venta) updatePayload.conceptos_venta = toDbJson(data.conceptos_venta);
  if (data.dimensiones_lcl) updatePayload.dimensiones_lcl = toDbJson(data.dimensiones_lcl);
  if (data.dimensiones_aereas)
    updatePayload.dimensiones_aereas = toDbJson(data.dimensiones_aereas);
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
