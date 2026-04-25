/**
 * Acceso puro a datos para proformas. Sin React Query, sin toasts.
 * Las mutaciones complejas viven aquí; los hooks solo orquestan cache + feedback.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import {
  calcularTotalesProforma,
  construirSnapshotConsolidado,
  sumarTotalesProformas,
  type MetaEmbarqueProforma,
} from "@/lib/domain/proforma";

export type ProformaRow = Tables<"proformas">;
export type ConceptoVentaRow = Tables<"conceptos_venta">;
export type ProformaConceptoConsolidadoRow = Tables<"proforma_conceptos_consolidados">;

// ── Tipos de joins (eliminan `as any` y `as unknown as`) ──
export type ProformaConFactura = ProformaRow & {
  facturas: { factura_pdf_url: string | null; factura_xml_url: string | null } | null;
};

export type ProformaPendienteConEmbarque = ProformaRow & {
  embarques: {
    expediente: string;
    bl_master: string | null;
    cliente_nombre: string;
    contenedor: string | null;
    tipo_contenedor: string | null;
  } | null;
};

// ──────────────────────────────────────────────────────────────────────────────
// Queries
// ──────────────────────────────────────────────────────────────────────────────

export async function fetchProformasEmbarque(embarqueId: string): Promise<ProformaConFactura[]> {
  const { data, error } = await supabase
    .from("proformas")
    .select("*, facturas:factura_id(factura_pdf_url, factura_xml_url)")
    .eq("embarque_id", embarqueId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ProformaConFactura[];
}

export async function fetchProformasAprobadas(organizationId: string): Promise<ProformaConFactura[]> {
  const { data, error } = await supabase
    .from("proformas")
    .select("*, facturas:factura_id(factura_pdf_url, factura_xml_url)")
    .eq("organization_id", organizationId)
    .eq("estado_revision", "aprobada")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ProformaConFactura[];
}

export async function fetchProformasPendientes(
  organizationId: string,
): Promise<ProformaPendienteConEmbarque[]> {
  const { data, error } = await supabase
    .from("proformas")
    .select(
      "*, embarques:embarque_id(expediente, bl_master, cliente_nombre, contenedor, tipo_contenedor)",
    )
    .eq("organization_id", organizationId)
    .eq("estado_revision", "pendiente")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ProformaPendienteConEmbarque[];
}

/** Carga los datos del cliente requeridos para el PDF de la proforma. */
export async function fetchClienteParaPdf(clienteId: string) {
  const { data, error } = await supabase
    .from("clientes")
    .select("nombre, rfc, direccion, ciudad, estado, cp")
    .eq("id", clienteId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Días de crédito por defecto del cliente (para precargar el diálogo de proforma). */
export async function fetchDiasCreditoCliente(clienteId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from("clientes")
    .select("dias_credito")
    .eq("id", clienteId)
    .maybeSingle();
  if (error) throw error;
  return data?.dias_credito ?? null;
}

export async function fetchEmbarqueParaPdf(embarqueId: string) {
  const { data, error } = await supabase
    .from("embarques")
    .select(
      "expediente, bl_master, modo, tipo, incoterm, puerto_origen, puerto_destino, aeropuerto_origen, aeropuerto_destino, ciudad_origen, ciudad_destino, naviera, aerolinea, descripcion_mercancia",
    )
    .eq("id", embarqueId)
    .single();
  if (error) throw error;
  return data;
}

export async function fetchConceptosProforma(proformaId: string): Promise<ConceptoVentaRow[]> {
  const { data, error } = await supabase
    .from("conceptos_venta")
    .select("*")
    .eq("proforma_id", proformaId);
  if (error) throw error;
  return data ?? [];
}

export async function fetchConceptosConsolidados(
  proformaId: string,
): Promise<ProformaConceptoConsolidadoRow[]> {
  const { data, error } = await supabase
    .from("proforma_conceptos_consolidados")
    .select("*")
    .eq("proforma_id", proformaId);
  if (error) throw error;
  return data ?? [];
}

// ──────────────────────────────────────────────────────────────────────────────
// Mutations
// ──────────────────────────────────────────────────────────────────────────────

export interface CrearProformaParams {
  organizationId: string;
  embarqueId: string;
  clienteId: string;
  clienteNombre: string;
  expediente: string;
  blMaster: string | null;
  conceptoIds: string[];
  totales: ReturnType<typeof calcularTotalesProforma>;
  notas: string | null;
  operador: string | null;
  diasCredito: number | null;
  /** Mapa conceptoId → aplica_iva (solo USD; MXN siempre true) */
  ivaOverrides?: Record<string, boolean>;
}

export async function crearProforma(params: CrearProformaParams): Promise<ProformaRow> {
  if (params.conceptoIds.length === 0) {
    throw new Error("Debe seleccionar al menos un concepto");
  }

  // 0. Aplicar overrides de IVA
  if (params.ivaOverrides) {
    const updates = Object.entries(params.ivaOverrides).map(([id, aplica]) =>
      supabase.from("conceptos_venta").update({ aplica_iva: aplica }).eq("id", id),
    );
    const results = await Promise.all(updates);
    const firstErr = results.find((r) => r.error);
    if (firstErr?.error) throw firstErr.error;
  }

  // 1. Número consecutivo
  const { data: numero, error: errNum } = await supabase.rpc("generar_numero_proforma", {
    p_org_id: params.organizationId,
  });
  if (errNum) throw errNum;

  // 2. Insertar proforma
  const { data: proforma, error: errProf } = await supabase
    .from("proformas")
    .insert({
      numero: numero as string,
      embarque_id: params.embarqueId,
      cliente_id: params.clienteId,
      cliente_nombre: params.clienteNombre,
      expediente: params.expediente,
      bl_master: params.blMaster,
      subtotal_usd: params.totales.subtotal_usd,
      iva_usd: params.totales.iva_usd,
      total_usd: params.totales.total_usd,
      subtotal_mxn: params.totales.subtotal_mxn,
      iva_mxn: params.totales.iva_mxn,
      total_mxn: params.totales.total_mxn,
      notas: params.notas,
      operador: params.operador,
      dias_credito: params.diasCredito,
      organization_id: params.organizationId,
    })
    .select()
    .single();
  if (errProf) throw errProf;

  // 3. Marcar conceptos como en_proforma (con rollback si falla)
  const { error: errUpd } = await supabase
    .from("conceptos_venta")
    .update({ estado_facturacion: "en_proforma", proforma_id: proforma.id })
    .in("id", params.conceptoIds);
  if (errUpd) {
    await supabase.from("proformas").delete().eq("id", proforma.id);
    throw errUpd;
  }

  return proforma as ProformaRow;
}

export interface EliminarProformaParams {
  proformaId: string;
  embarqueId: string;
}

export async function eliminarProforma(params: EliminarProformaParams): Promise<void> {
  // Liberar conceptos
  const { error: errUpd } = await supabase
    .from("conceptos_venta")
    .update({ estado_facturacion: "pendiente", proforma_id: null })
    .eq("proforma_id", params.proformaId);
  if (errUpd) throw errUpd;

  const { error: errDel } = await supabase
    .from("proformas")
    .delete()
    .eq("id", params.proformaId);
  if (errDel) throw errDel;

  // tiene_proforma del embarque
  const { count, error: errCount } = await supabase
    .from("proformas")
    .select("id", { count: "exact", head: true })
    .eq("embarque_id", params.embarqueId);
  if (errCount) throw errCount;

  if ((count ?? 0) === 0) {
    const { error: errEmb } = await supabase
      .from("embarques")
      .update({ tiene_proforma: false })
      .eq("id", params.embarqueId);
    if (errEmb) throw errEmb;
  }
}

export interface MarcarFacturadaParams {
  proformaId: string;
  folioFacturaExterna: string;
  fechaFacturacion: string; // YYYY-MM-DD
  pdfFile?: File | null;
  xmlFile?: File | null;
}

function addDays(yyyyMmDd: string, days: number): string {
  const d = new Date(yyyyMmDd + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export async function marcarProformaFacturada(params: MarcarFacturadaParams): Promise<void> {
  const { data: proforma, error: errProf } = await supabase
    .from("proformas")
    .select("*")
    .eq("id", params.proformaId)
    .single();
  if (errProf) throw errProf;

  let pdfUrl: string | null = null;
  let xmlUrl: string | null = null;
  const basePath = `${proforma.organization_id}/${proforma.id}`;

  if (params.pdfFile) {
    const path = `${basePath}/factura.pdf`;
    const { error: errUp } = await supabase.storage
      .from("facturas")
      .upload(path, params.pdfFile, { upsert: true, contentType: "application/pdf" });
    if (errUp) throw new Error(`Error al subir PDF: ${errUp.message}`);
    pdfUrl = supabase.storage.from("facturas").getPublicUrl(path).data.publicUrl;
  }
  if (params.xmlFile) {
    const path = `${basePath}/factura.xml`;
    const { error: errUp } = await supabase.storage
      .from("facturas")
      .upload(path, params.xmlFile, { upsert: true, contentType: "application/xml" });
    if (errUp) throw new Error(`Error al subir XML: ${errUp.message}`);
    xmlUrl = supabase.storage.from("facturas").getPublicUrl(path).data.publicUrl;
  }

  const dias = proforma.dias_credito ?? 0;
  const fechaVencimiento = addDays(params.fechaFacturacion, dias);

  const baseFactura = {
    numero: params.folioFacturaExterna,
    proforma_id: proforma.id,
    embarque_id: proforma.embarque_id!,
    cliente_id: proforma.cliente_id,
    cliente_nombre: proforma.cliente_nombre,
    expediente: proforma.expediente,
    fecha_emision: params.fechaFacturacion,
    fecha_vencimiento: fechaVencimiento,
    estado: "Emitida" as const,
    factura_pdf_url: pdfUrl,
    factura_xml_url: xmlUrl,
    organization_id: proforma.organization_id,
  };

  const facturasACrear: Array<typeof baseFactura & {
    moneda: "USD" | "MXN"; subtotal: number; iva: number; total: number;
  }> = [];
  if (Number(proforma.total_usd) > 0) {
    facturasACrear.push({
      ...baseFactura, moneda: "USD",
      subtotal: Number(proforma.subtotal_usd),
      iva: Number(proforma.iva_usd),
      total: Number(proforma.total_usd),
    });
  }
  if (Number(proforma.total_mxn) > 0) {
    facturasACrear.push({
      ...baseFactura, moneda: "MXN",
      subtotal: Number(proforma.subtotal_mxn),
      iva: Number(proforma.iva_mxn),
      total: Number(proforma.total_mxn),
    });
  }

  let primeraFacturaId: string | null = null;
  if (facturasACrear.length > 0) {
    const { data: facturasCreadas, error: errFact } = await supabase
      .from("facturas")
      .insert(facturasACrear)
      .select("id");
    if (errFact) throw new Error(`Error al crear factura: ${errFact.message}`);
    primeraFacturaId = facturasCreadas?.[0]?.id ?? null;
  }

  const { error: errUpd } = await supabase
    .from("proformas")
    .update({
      estado_proforma: "facturada",
      folio_factura_externa: params.folioFacturaExterna,
      fecha_facturacion: params.fechaFacturacion,
      factura_id: primeraFacturaId,
    })
    .eq("id", params.proformaId);
  if (errUpd) throw errUpd;
}

export async function aprobarProformas(proformaIds: string[]): Promise<void> {
  if (proformaIds.length === 0) throw new Error("Selecciona al menos una proforma");
  const { error } = await supabase
    .from("proformas")
    .update({ estado_revision: "aprobada" })
    .in("id", proformaIds);
  if (error) throw error;
}

export interface ConsolidarProformasParams {
  organizationId: string;
  proformaIds: string[];
  embarqueId: string;
  clienteId: string;
  clienteNombre: string;
  expediente: string;
  blMaster: string | null;
  operador: string | null;
  diasCredito: number | null;
  /** Tasa de IVA vigente (no hard-codear). */
  tasaIva: number;
}

type ProformaOriginalLite = {
  id: string;
  embarque_id: string | null;
  subtotal_usd: number | string | null;
  iva_usd: number | string | null;
  total_usd: number | string | null;
  subtotal_mxn: number | string | null;
  iva_mxn: number | string | null;
  total_mxn: number | string | null;
  embarques: { contenedor: string | null; tipo_contenedor: string | null } | null;
};

export async function consolidarProformas(params: ConsolidarProformasParams): Promise<ProformaRow> {
  if (params.proformaIds.length < 2) {
    throw new Error("Selecciona al menos 2 proformas para consolidar");
  }

  // 1. Cargar originales
  const { data: originalesRaw, error: errLoad } = await supabase
    .from("proformas")
    .select(
      "id, embarque_id, subtotal_usd, iva_usd, total_usd, subtotal_mxn, iva_mxn, total_mxn, embarques:embarque_id(contenedor, tipo_contenedor)",
    )
    .in("id", params.proformaIds);
  if (errLoad) throw errLoad;
  const originales = (originalesRaw ?? []) as unknown as ProformaOriginalLite[];
  if (originales.length !== params.proformaIds.length) {
    throw new Error("No se pudieron cargar todas las proformas seleccionadas");
  }

  // 2. Cargar conceptos
  const { data: conceptosOrig, error: errConc } = await supabase
    .from("conceptos_venta")
    .select("descripcion, cantidad, precio_unitario, total, moneda, aplica_iva, proforma_id")
    .in("proforma_id", params.proformaIds);
  if (errConc) throw errConc;

  // 3. Sumar totales (lógica pura)
  const totales = sumarTotalesProformas(originales);

  // 4. Generar número y crear proforma consolidada
  const { data: numero, error: errNum } = await supabase.rpc("generar_numero_proforma", {
    p_org_id: params.organizationId,
  });
  if (errNum) throw errNum;

  const { data: nueva, error: errIns } = await supabase
    .from("proformas")
    .insert({
      numero: numero as string,
      embarque_id: params.embarqueId,
      cliente_id: params.clienteId,
      cliente_nombre: params.clienteNombre,
      expediente: params.expediente,
      bl_master: params.blMaster,
      ...totales,
      notas: `Consolidación de ${params.proformaIds.length} proformas`,
      operador: params.operador,
      dias_credito: params.diasCredito,
      organization_id: params.organizationId,
      estado_revision: "aprobada",
      es_consolidada: true,
      proformas_origen: params.proformaIds,
    })
    .select()
    .single();
  if (errIns) throw errIns;

  // 5. Snapshot conceptos consolidados
  const metaPorProforma = new Map<string, MetaEmbarqueProforma>();
  for (const o of originales) {
    metaPorProforma.set(o.id, {
      embarque_id: o.embarque_id,
      contenedor: o.embarques?.contenedor ?? null,
      tipo_contenedor: o.embarques?.tipo_contenedor ?? null,
    });
  }
  const conceptosSnap = construirSnapshotConsolidado({
    conceptos: (conceptosOrig ?? []).map((c) => ({
      descripcion: c.descripcion,
      cantidad: c.cantidad as number,
      precio_unitario: c.precio_unitario as number,
      moneda: c.moneda as string,
      aplica_iva: c.aplica_iva,
      proforma_id: c.proforma_id as string,
    })),
    metaPorProforma,
    proformaConsolidadaId: nueva.id,
    organizationId: params.organizationId,
    tasaIva: params.tasaIva,
  });

  if (conceptosSnap.length > 0) {
    const { error: errSnap } = await supabase
      .from("proforma_conceptos_consolidados")
      .insert(conceptosSnap);
    if (errSnap) {
      await supabase.from("proformas").delete().eq("id", nueva.id);
      throw errSnap;
    }
  }

  // 6. Marcar originales como consolidadas
  const { error: errUpd } = await supabase
    .from("proformas")
    .update({ estado_revision: "consolidada", consolidada_en: nueva.id })
    .in("id", params.proformaIds);
  if (errUpd) {
    await supabase.from("proforma_conceptos_consolidados").delete().eq("proforma_id", nueva.id);
    await supabase.from("proformas").delete().eq("id", nueva.id);
    throw errUpd;
  }

  return nueva as ProformaRow;
}
