/**
 * Servicios del buzón de facturas de proveedor (CxP Inbox).
 * El operador sube el archivo; contabilidad lo captura o lo rechaza.
 */
import { supabase } from "@/integrations/supabase/client";
import {
  rutaArchivoEntrante,
  validarArchivoEntrante,
} from "@/lib/domain/facturasEntrantes";

const BUCKET = "cxp-inbox";

export interface FacturaEntranteRow {
  id: string;
  embarque_id: string;
  organization_id: string;
  archivo_path: string;
  archivo_hash: string;
  nombre_archivo: string;
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
  proveedores?: { nombre: string | null } | null;
}

const SELECT_COLS =
  "id, embarque_id, organization_id, archivo_path, archivo_hash, nombre_archivo, nota, estado," +
  " proveedor_id, proveedor_factura_id, folio_detectado, total_detectado, moneda_detectada," +
  " rechazo_motivo, subido_por, capturado_por, created_at," +
  " embarques:embarque_id(expediente), proveedores:proveedor_id(nombre)";

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
  file: File;
  embarqueId: string;
  organizationId: string;
  proveedorId?: string | null;
  nota?: string | null;
}

export async function subirFacturaEntrante(input: SubirFacturaEntranteInput): Promise<string> {
  const invalido = validarArchivoEntrante(input.file);
  if (invalido) throw new Error(invalido);

  const hash = await calcularHash(input.file);
  const path = rutaArchivoEntrante({
    organizationId: input.organizationId,
    embarqueId: input.embarqueId,
    hash,
    nombreArchivo: input.file.name,
  });

  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(path, input.file, { upsert: true, contentType: input.file.type || undefined });
  if (upErr) throw upErr;

  const { data: userData } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from("embarque_facturas_entrantes")
    .insert({
      embarque_id: input.embarqueId,
      organization_id: input.organizationId,
      archivo_path: path,
      archivo_hash: hash,
      nombre_archivo: input.file.name,
      nota: input.nota?.trim() || null,
      proveedor_id: input.proveedorId ?? null,
      subido_por: userData?.user?.id ?? null,
    })
    .select("id")
    .single();
  if (error) {
    if (/duplicate key|unique/i.test(error.message)) {
      throw new Error("Este archivo ya fue subido al buzón de este embarque.");
    }
    throw error;
  }
  return data.id;
}

export async function urlFirmadaFacturaEntrante(path: string, expiraEn = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiraEn);
  if (error) throw error;
  return data.signedUrl;
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
  const blobUrl = URL createObjectURLPlaceholder(data);
  const ventana = window.open(blobUrl, "_blank", "noopener,noreferrer");
  if (!ventana) {
    descargarBlob(data, nombreArchivo);
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export async function eliminarFacturaEntrante(row: Pick<FacturaEntranteRow, "id" | "archivo_path">) {
  const { error } = await supabase
    .from("embarque_facturas_entrantes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", row.id);
  if (error) throw error;
  await supabase.storage.from(BUCKET).remove([row.archivo_path]);
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
