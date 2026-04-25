/**
 * Servicio de cotizaciones: encapsula todas las llamadas a Supabase
 * relacionadas con cotizaciones, costos y conversiones a embarques.
 */
import { supabase } from "@/integrations/supabase/client";
import { uploadFile } from "@/services/storage";
import type { Json, Tables, TablesInsert } from "@/integrations/supabase/types";
import type { CotizacionFormValues } from "@/hooks/cotizacion/useCotizacionWizardForm";
import type {
  CotizacionRow,
  CreateCotizacionInput,
} from "@/hooks/cotizacion/useCotizacionTypes";
import type { CostoCotizacion } from "@/hooks/cotizacion/useCotizacionCostos";
import type { FilaCostoLocal } from "@/components/cotizacion/SeccionCostosInternosPLUnificado";
import { CONCEPTOS_CON_IVA_USD } from "@/constants/cotizacionConstants";
import { calcularTotalConIVA } from "@/lib/financialUtils";

type CotizacionInsert = TablesInsert<"cotizaciones">;
type CotizacionUpdate = Partial<CotizacionInsert>;
type EmbarqueInsert = TablesInsert<"embarques">;

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

export async function fetchCotizacionById(id: string): Promise<CotizacionRow> {
  const { data, error } = await supabase
    .from("cotizaciones")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as unknown as CotizacionRow;
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

// ─── Costos ─────────────────────────────────────────────────────────────────
export async function fetchCotizacionCostos(
  cotizacionId: string,
): Promise<CostoCotizacion[]> {
  const { data, error } = await supabase
    .from("cotizacion_costos")
    .select("*")
    .eq("cotizacion_id", cotizacionId);
  if (error) throw error;
  return (data ?? []) as unknown as CostoCotizacion[];
}

export async function upsertCotizacionCostos(
  cotizacionId: string,
  costos: CostoCotizacion[],
): Promise<CostoCotizacion[]> {
  const { error: delError } = await supabase
    .from("cotizacion_costos")
    .delete()
    .eq("cotizacion_id", cotizacionId);
  if (delError) throw delError;

  if (costos.length === 0) return [];

  const rows = costos.map((c) => ({
    cotizacion_id: cotizacionId,
    concepto: c.concepto,
    moneda: c.moneda,
    proveedor: c.proveedor,
    cantidad: c.cantidad,
    costo_unitario: c.costo_unitario,
    precio_venta: c.precio_venta ?? 0,
    unidad_medida: c.unidad_medida ?? "",
    notas: c.notas ?? "",
  }));

  const { data, error } = await supabase.from("cotizacion_costos").insert(rows).select();
  if (error) throw error;
  return (data ?? []) as unknown as CostoCotizacion[];
}

// ─── Duplicar ───────────────────────────────────────────────────────────────
export async function duplicarCotizacion(
  cotizacionId: string,
): Promise<{ id: string; folio: string }> {
  const { data: orig, error: errOrig } = await supabase
    .from("cotizaciones")
    .select("*")
    .eq("id", cotizacionId)
    .single();
  if (errOrig) throw errOrig;

  const folio = await generarFolioCotizacion();
  const fechaVigencia = new Date();
  fechaVigencia.setDate(fechaVigencia.getDate() + (orig.vigencia_dias ?? 15));

  const {
    id: _id,
    created_at: _ca,
    updated_at: _ua,
    folio: _f,
    estado: _e,
    embarque_id: _eid,
    fecha_vigencia: _fv,
    ...rest
  } = orig;

  const payload: CotizacionInsert = {
    ...rest,
    folio,
    estado: "Borrador",
    embarque_id: null,
    fecha_vigencia: fechaVigencia.toISOString().split("T")[0],
    conceptos_venta: rest.conceptos_venta as Json,
    dimensiones_lcl: rest.dimensiones_lcl as Json,
    dimensiones_aereas: rest.dimensiones_aereas as Json,
  } as CotizacionInsert;

  const { data, error } = await supabase
    .from("cotizaciones")
    .insert(payload)
    .select("id, folio")
    .single();
  if (error) throw error;

  // Duplicate costos
  const { data: costos } = await supabase
    .from("cotizacion_costos")
    .select("*")
    .eq("cotizacion_id", cotizacionId);
  if (costos && costos.length > 0) {
    const nuevos = costos.map(
      ({ id: _cid, created_at: _cca, updated_at: _cua, cotizacion_id: _ccid, ...c }) => ({
        ...c,
        cotizacion_id: data.id,
      }),
    );
    await supabase.from("cotizacion_costos").insert(nuevos);
  }

  return data as { id: string; folio: string };
}

// ─── Conversions: prospecto → cliente ───────────────────────────────────────
export interface ProspectoAClienteInput {
  cotizacionId: string;
  clienteData: {
    nombre: string;
    contacto: string;
    email: string;
    telefono: string;
    rfc?: string;
    direccion?: string;
    ciudad?: string;
    estado?: string;
    cp?: string;
  };
  user: { id: string; email?: string | null } | null;
}

export async function convertirProspectoACliente(input: ProspectoAClienteInput) {
  const { cotizacionId, clienteData, user } = input;
  const { data: clienteCreado, error: errorCliente } = await supabase
    .from("clientes")
    .insert({
      nombre: clienteData.nombre,
      contacto: clienteData.contacto,
      email: clienteData.email,
      telefono: clienteData.telefono,
      rfc: clienteData.rfc || "",
      direccion: clienteData.direccion || "",
      ciudad: clienteData.ciudad || "",
      estado: clienteData.estado || "",
      cp: clienteData.cp || "",
    })
    .select()
    .single();
  if (errorCliente) throw errorCliente;

  const { error: errorUpdate } = await supabase
    .from("cotizaciones")
    .update({
      cliente_id: clienteCreado.id,
      cliente_nombre: clienteCreado.nombre,
      es_prospecto: false,
    })
    .eq("id", cotizacionId);
  if (errorUpdate) throw errorUpdate;

  if (user) {
    await supabase.from("bitacora_actividad").insert({
      usuario_id: user.id,
      usuario_email: user.email ?? "",
      accion: "Convertir prospecto a cliente",
      modulo: "Cotizaciones",
      entidad_id: cotizacionId,
      entidad_nombre: clienteCreado.nombre,
      detalles: { cliente_id: clienteCreado.id } as unknown as Json,
    });
  }

  return clienteCreado;
}

// ─── Conversions: cotización → embarques ────────────────────────────────────
export async function convertirCotizacionAEmbarques(
  cotizacion: CotizacionRow,
): Promise<Tables<"embarques">[]> {
  const { data: costos, error: errorCostos } = await supabase
    .from("cotizacion_costos")
    .select("*")
    .eq("cotizacion_id", cotizacion.id);
  if (errorCostos) throw errorCostos;

  const numContenedores = cotizacion.num_contenedores ?? 1;
  const embarquesCreados: Tables<"embarques">[] = [];

  for (let i = 0; i < numContenedores; i++) {
    const { data: expediente, error: errorExp } = await supabase.rpc("generar_expediente", {
      tipo_op: cotizacion.tipo,
    });
    if (errorExp) throw errorExp;

    const embarqueInsert: EmbarqueInsert = {
      cotizacion_id: cotizacion.id,
      expediente: expediente as string,
      cliente_id: cotizacion.cliente_id!,
      cliente_nombre: cotizacion.cliente_nombre,
      estado: "Confirmado",
      modo: cotizacion.modo,
      tipo: cotizacion.tipo,
      incoterm: cotizacion.incoterm,
      descripcion_mercancia: cotizacion.descripcion_mercancia,
      peso_kg: cotizacion.peso_kg,
      volumen_m3: cotizacion.volumen_m3,
      piezas: cotizacion.piezas,
      operador: cotizacion.operador,
      tipo_carga: cotizacion.tipo_carga,
      tipo_contenedor: cotizacion.tipo_contenedor,
    };

    const { data: embarque, error: errorEmb } = await supabase
      .from("embarques")
      .insert(embarqueInsert)
      .select()
      .single();
    if (errorEmb) throw errorEmb;

    if (costos && costos.length > 0) {
      const conceptosParaInsertar = costos.filter((c) => {
        const um = c.unidad_medida ?? "Contenedor";
        if (um === "BL") return i === 0;
        return true;
      });

      if (conceptosParaInsertar.length > 0) {
        const rows: TablesInsert<"conceptos_costo">[] = conceptosParaInsertar.map((c) => ({
          embarque_id: embarque.id,
          concepto: c.concepto,
          monto: c.costo_unitario,
          moneda: c.moneda as TablesInsert<"conceptos_costo">["moneda"],
          proveedor_nombre: c.proveedor,
        }));

        const { error: errorConceptos } = await supabase.from("conceptos_costo").insert(rows);
        if (errorConceptos) throw errorConceptos;
      }
    }

    embarquesCreados.push(embarque);
  }

  const { error: errorUpdate } = await supabase
    .from("cotizaciones")
    .update({ estado: "Embarcada" as CotizacionInsert["estado"] })
    .eq("id", cotizacion.id);
  if (errorUpdate) throw errorUpdate;

  return embarquesCreados;
}

// ─── Portal: responder cotización ───────────────────────────────────────────
export async function portalResponderCotizacion(
  cotizacionId: string,
  respuesta: "Aceptada" | "Rechazada",
  comentario: string,
): Promise<void> {
  const { error } = await supabase.rpc("portal_responder_cotizacion", {
    p_cotizacion_id: cotizacionId,
    p_respuesta: respuesta,
    p_comentario: comentario,
  });
  if (error) throw error;
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
    .select("concepto, costo_unitario, moneda, proveedor")
    .eq("cotizacion_id", cotizacionId);
  if (error) throw new Error(error.message);
  return (data ?? []) as CotizacionCostoLookup[];
}

// ─── Funciones puras de wizard (sin I/O directo a DB) ───────────────────────
interface Mutations {
  crearCotizacion: { mutateAsync: (d: CreateCotizacionInput) => Promise<{ id: string }> };
  updateCotizacion: { mutateAsync: (d: { id: string; data: Record<string, unknown> }) => Promise<void> };
  upsertCostos: { mutateAsync: (d: { cotizacionId: string; costos: CostoCotizacion[] }) => Promise<CostoCotizacion[]> };
}

export async function savePaso1(opts: {
  form: { getValues: () => CotizacionFormValues };
  msdsFile: File | null;
  cotizacionId: string | null;
  buildPaso1Data: () => Record<string, unknown>;
  mutations: Pick<Mutations, "crearCotizacion" | "updateCotizacion">;
}): Promise<string> {
  const { form, msdsFile, cotizacionId, buildPaso1Data, mutations } = opts;
  const v = form.getValues();

  let msdsArchivo: string | null = null;
  if (v.tipoCarga === "Mercancía Peligrosa" && msdsFile) {
    const ext = msdsFile.name.split(".").pop() || "pdf";
    const path = `cotizaciones/msds-${Date.now()}.${ext}`;
    await uploadFile(path, msdsFile);
    msdsArchivo = path;
  }

  const data = buildPaso1Data();
  data.msds_archivo = msdsArchivo;

  if (cotizacionId) {
    await mutations.updateCotizacion.mutateAsync({ id: cotizacionId, data });
    return cotizacionId;
  } else {
    const cotizacion = await mutations.crearCotizacion.mutateAsync(data as unknown as CreateCotizacionInput);
    return cotizacion.id;
  }
}

export async function savePaso2(opts: {
  cotizacionId: string;
  costosInternos: FilaCostoLocal[];
  mutations: Pick<Mutations, "upsertCostos">;
}): Promise<void> {
  const { cotizacionId, costosInternos, mutations } = opts;
  if (costosInternos.length === 0) return;

  const costos: CostoCotizacion[] = costosInternos.map(f => ({
    id: "", cotizacion_id: cotizacionId, concepto: f.concepto, moneda: f.moneda,
    proveedor: f.proveedor, cantidad: f.cantidad, costo_unitario: f.costo_unitario,
    costo_total: f.cantidad * f.costo_unitario, precio_venta: f.precio_venta,
    unidad_medida: f.unidad_medida, notas: f.notas ?? "", created_at: "", updated_at: "",
  }));
  await mutations.upsertCostos.mutateAsync({ cotizacionId, costos });
}

export interface ConceptoVentaPrellenado {
  descripcion: string;
  unidad_medida: string;
  cantidad: number;
  precio_unitario: number;
  moneda: "USD" | "MXN";
  aplica_iva: boolean;
  total: number;
}

export function buildConceptosFromCostos(costosInternos: FilaCostoLocal[], tasaIva: number): {
  usd: ConceptoVentaPrellenado[];
  mxn: ConceptoVentaPrellenado[];
} {
  const usd = costosInternos
    .filter(c => c.moneda === "USD" && c.concepto.trim())
    .map(c => {
      const tieneIva = (CONCEPTOS_CON_IVA_USD as readonly string[]).includes(c.concepto);
      return {
        descripcion: c.concepto, unidad_medida: c.unidad_medida, cantidad: c.cantidad,
        precio_unitario: c.precio_venta, moneda: "USD" as const, aplica_iva: tieneIva,
        total: tieneIva ? calcularTotalConIVA(c.cantidad * c.precio_venta, tasaIva) : c.cantidad * c.precio_venta,
      };
    });

  const mxn = costosInternos
    .filter(c => c.moneda === "MXN" && c.concepto.trim())
    .map(c => ({
      descripcion: c.concepto, unidad_medida: c.unidad_medida, cantidad: c.cantidad,
      precio_unitario: c.precio_venta, moneda: "MXN" as const, aplica_iva: true,
      total: calcularTotalConIVA(c.cantidad * c.precio_venta, tasaIva),
    }));

  return { usd, mxn };
}

export async function savePaso3(opts: {
  cotizacionId: string;
  conceptosVenta: Record<string, unknown>[];
  totalUSD: number;
  mutations: Pick<Mutations, "updateCotizacion">;
}): Promise<void> {
  const { cotizacionId, conceptosVenta, totalUSD, mutations } = opts;
  await mutations.updateCotizacion.mutateAsync({
    id: cotizacionId,
    data: { conceptos_venta: conceptosVenta, subtotal: totalUSD },
  });
}

export async function savePasoFinal(opts: {
  cotizacionId: string;
  isEditMode: boolean;
  mutations: Pick<Mutations, "updateCotizacion">;
  registrarActividad: (d: { accion: string; modulo: string; entidad_id?: string | null; entidad_nombre?: string }) => void;
}): Promise<void> {
  const { cotizacionId, isEditMode, mutations, registrarActividad } = opts;
  if (!isEditMode) {
    await mutations.updateCotizacion.mutateAsync({ id: cotizacionId, data: { estado: "Borrador" } });
  }
  registrarActividad({
    accion: isEditMode ? "editar" : "crear", modulo: "cotizaciones",
    entidad_id: cotizacionId, entidad_nombre: "",
  });
}
