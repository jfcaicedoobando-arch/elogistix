/**
 * Servicios del buzón de facturas de proveedor (CxP Inbox).
 * El operador sube el archivo; contabilidad lo captura o lo rechaza.
 *
 * v13.360.0 — Un documento = PDF + XML del mismo CFDI (proveedores mexicanos).
 */
import { supabase } from "@/integrations/supabase/client";
import { descargarBlob } from "@/lib/downloadBlob";
import {
  rutaArchivoEntrante,
  validarParejaEntrante,
} from "@/lib/domain/facturasEntrantes";
import type { CfdiXmlMeta } from "@/lib/domain/cfdiXmlMeta";

const BUCKET = "cxp-inbox";

export interface FacturaEntranteRow {
  id: string;
  embarque_id: string;
  organization_id: string;
  archivo_path: string;
  archivo_hash: string;
  nombre_archivo: string;
  xml_path: string | null;
  xml_nombre: string | null;
  uuid_fiscal: string | null;
  rfc_emisor: string | null;
  folio_serie: string | null;
  fecha_emision: string | null;
  nota: string | null;
  estado: string;
  proveedor_id: string | null;
  proveedor_factura_id: string | null;
  folio_detectado: string | null;
  total_detectado: number | null;
  moneda_detectada: string | null;
  rechazo_motivo: string | null;
  subido_por: string | null;
  capturado_por: string | null;
  created_at: string;
  embarques?: { expediente: string | null } | null;
  proveedores?: { nombre: string | null; origen?: string | null } | null;
}

const SELECT_COLS =
  "id, embarque_id, organization_id, archivo_path, archivo_hash, nombre_archivo, nota, estado," +
  " xml_path, xml_nombre, uuid_fiscal, rfc_emisor, folio_serie, fecha_emision," +
  " proveedor_id, proveedor_factura_id, folio_detectado, total_detectado, moneda_detectada," +
  " rechazo_motivo, subido_por, capturado_por, created_at," +
  " embarques:embarque_id(expediente), proveedores:proveedor_id(nombre, origen)";

export async function listarFacturasEntrantesPorEmbarque(
  embarqueId: string,
): Promise<FacturaEntranteRow[]> {
  const { data, error } = await supabase
    .from("embarque_facturas_entrantes")
    .select(SELECT_COLS)
    .eq("embarque_id", embarqueId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  // SAFE-CAST: el join anidado de PostgREST no se refleja en los tipos generados;
  // las columnas provienen de SELECT_COLS y se validan en el dominio.
  return (data ?? []) as unknown as FacturaEntranteRow[];
}

export async function listarFacturasEntrantesPendientes(
  limite = 200,
): Promise<FacturaEntranteRow[]> {
  const { data, error } = await supabase
    .from("embarque_facturas_entrantes")
    .select(SELECT_COLS)
    .eq("estado", "por_capturar")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(limite);
  if (error) throw error;
  // SAFE-CAST: el join anidado de PostgREST no se refleja en los tipos generados;
  // las columnas provienen de SELECT_COLS y se validan en el dominio.
  return (data ?? []) as unknown as FacturaEntranteRow[];
}

async function calcularHash(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface SubirFacturaEntranteInput {
  /** PDF de la factura (opcional si el proveedor sólo mandó el XML). */
  pdf: File | null;
  /** XML del CFDI (proveedores mexicanos). */
  xml: File | null;
  meta?: CfdiXmlMeta | null;
  embarqueId: string;
  organizationId: string;
  proveedorId?: string | null;
  nota?: string | null;
}

async function subirArchivo(
  file: File,
  input: SubirFacturaEntranteInput,
): Promise<ArchivoSubido> {
  const hash = await calcularHash(file);
  const path = rutaArchivoEntrante({
    organizationId: input.organizationId,
    embarqueId: input.embarqueId,
    hash,
    nombreArchivo: file.name,
  });
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type || undefined });
  if (error) throw error;
  return { path, hash, nombre: file.name };
}

function mensajeDuplicado(mensaje: string): string | null {
  if (/uq_efe_uuid_fiscal/i.test(mensaje)) {
    return "El XML de esta factura ya está en el buzón (mismo UUID fiscal).";
  }
  if (/duplicate key|unique/i.test(mensaje)) {
    return "Este archivo ya fue subido al buzón de este embarque.";
  }
  return null;
}


/** Arma el renglón a insertar; aísla el mapeo para mantener baja la complejidad. */
function filaEntranteAInsertar(params: {
  input: SubirFacturaEntranteInput;
  principal: ArchivoSubido;
  xmlSubido: ArchivoSubido | null;
  userId: string | null;
}) {
  const { input, principal, xmlSubido, userId } = params;
  return {
    embarque_id: input.embarqueId,
    organization_id: input.organizationId,
    archivo_path: principal.path,
    archivo_hash: principal.hash,
    nombre_archivo: principal.nombre,
    ...columnasXmlEntrante({ soloXml: !input.pdf, principal, xmlSubido }),
    ...columnasMetaEntrante(input.meta),
    nota: input.nota?.trim() || null,
    proveedor_id: input.proveedorId ?? null,
    subido_por: userId,
  };
}


export async function subirFacturaEntrante(input: SubirFacturaEntranteInput): Promise<string> {
  const invalido = validarParejaEntrante({ pdf: input.pdf, xml: input.xml });
  if (invalido) throw new Error(invalido);

  // El registro principal apunta al PDF cuando existe; si sólo hay XML, a él.
  const principal = await subirArchivo((input.pdf ?? input.xml) as File, input);
  const xmlSubido = input.pdf && input.xml ? await subirArchivo(input.xml, input) : null;

  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("embarque_facturas_entrantes")
    .insert(filaEntranteAInsertar({
      input,
      principal,
      xmlSubido,
      userId: userData?.user?.id ?? null,
    }))
    .select("id")
    .single();
  if (error) {
    const duplicado = mensajeDuplicado(`${error.message} ${error.details ?? ""}`);
    if (duplicado) throw new Error(duplicado);
    throw error;
  }
  return data.id;
}


/**
 * v13.359.0 — Abre el archivo del buzón sin navegar al dominio del backend.
 *
 * Algunas extensiones (adblockers, DNS filtering corporativo) bloquean la
 * navegación directa a `*.supabase.co` con `ERR_BLOCKED_BY_CLIENT`. Por eso el
 * archivo se descarga como Blob y se abre desde una URL local (`blob:`); si el
 * navegador bloquea la pestaña, se cae a una descarga normal.
 */
export async function abrirFacturaEntrante(
  path: string,
  nombreArchivo: string,
): Promise<void> {
  const { data, error } = await supabase.storage.from(BUCKET).download(path);
  if (error) throw error;
  // El XML no se renderiza en el navegador: se descarga directo.
  if (path.toLowerCase().endsWith(".xml")) {
    descargarBlob(data, nombreArchivo);
    return;
  }
  const blobUrl = URL.createObjectURL(data);
  const ventana = window.open(blobUrl, "_blank", "noopener,noreferrer");
  if (!ventana) {
    descargarBlob(data, nombreArchivo);
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

/** Completa un documento existente adjuntándole el XML que faltaba. */
export async function adjuntarXmlFacturaEntrante(params: {
  id: string;
  xml: File;
  meta: CfdiXmlMeta | null;
  embarqueId: string;
  organizationId: string;
}): Promise<void> {
  const subido = await subirArchivo(params.xml, {
    pdf: null,
    xml: params.xml,
    embarqueId: params.embarqueId,
    organizationId: params.organizationId,
  });
  const { error } = await supabase
    .from("embarque_facturas_entrantes")
    .update({
      xml_path: subido.path,
      xml_nombre: subido.nombre,
      xml_hash: subido.hash,
      uuid_fiscal: params.meta?.uuid ?? null,
      rfc_emisor: params.meta?.rfcEmisor ?? null,
      folio_serie: params.meta?.folioSerie ?? null,
      fecha_emision: params.meta?.fechaEmision ?? null,
      total_detectado: params.meta?.total ?? null,
      moneda_detectada: params.meta?.moneda ?? null,
    })
    .eq("id", params.id);
  if (error) {
    const duplicado = mensajeDuplicado(`${error.message} ${error.details ?? ""}`);
    throw duplicado ? new Error(duplicado) : error;
  }
}

export async function eliminarFacturaEntrante(row: Pick<FacturaEntranteRow, "id" | "archivo_path" | "xml_path">) {
  const { error } = await supabase
    .from("embarque_facturas_entrantes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", row.id);
  if (error) throw error;
  const paths = [row.archivo_path, row.xml_path].filter((p): p is string => Boolean(p));
  await supabase.storage.from(BUCKET).remove(paths);
}

export async function rechazarFacturaEntrante(documentoId: string, motivo: string) {
  const { error } = await supabase.rpc("rechazar_factura_entrante", {
    p_documento_id: documentoId,
    p_motivo: motivo,
  });
  if (error) throw error;
}

export async function capturarFacturaEntrante(documentoId: string, facturaId: string) {
  const { error } = await supabase.rpc("capturar_factura_entrante", {
    p_documento_id: documentoId,
    p_factura_id: facturaId,
  });
  if (error) throw error;
}
