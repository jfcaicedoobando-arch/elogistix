/**
 * Servicios del buzón de facturas de proveedor (CxP Inbox).
 * El operador sube el archivo; contabilidad lo captura o lo rechaza.
 *
 * v13.360.0 — Un documento = PDF + XML del mismo CFDI (proveedores mexicanos).
 * v13.361.2 — Tipos en `facturasEntrantes.types.ts` y subidas en
 *             `facturasEntrantesUpload.ts` (Power of 10: ≤ 200 líneas).
 */
import { supabase } from "@/integrations/supabase/client";
import { descargarBlob } from "@/lib/downloadBlob";
import { crearUrlPdf } from "@/lib/pdf/blobPdfUrl";
import {
  BUCKET_CXP_INBOX,
  SELECT_COLS_ENTRANTES,
  type FacturaEntranteRow,
} from "@/features/cxp/services/facturasEntrantes.types";
import { registrarActividad } from "@/services/bitacora/registrar";

export type {
  FacturaEntranteRow,
  SubirFacturaEntranteInput,
} from "@/features/cxp/services/facturasEntrantes.types";
export {
  subirFacturaEntrante,
  adjuntarXmlFacturaEntrante,
} from "@/features/cxp/services/facturasEntrantesUpload";

export async function listarFacturasEntrantesPorEmbarque(
  embarqueId: string,
): Promise<FacturaEntranteRow[]> {
  const { data, error } = await supabase
    .from("embarque_facturas_entrantes")
    .select(SELECT_COLS_ENTRANTES)
    .eq("embarque_id", embarqueId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  // SAFE-CAST: el join anidado de PostgREST no se refleja en los tipos generados;
  // las columnas provienen de SELECT_COLS_ENTRANTES y se validan en el dominio.
  return (data ?? []) as unknown as FacturaEntranteRow[];
}

export async function listarFacturasEntrantesPendientes(
  limite = 200,
): Promise<FacturaEntranteRow[]> {
  const { data, error } = await supabase
    .from("embarque_facturas_entrantes")
    .select(SELECT_COLS_ENTRANTES)
    .eq("estado", "por_capturar")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })
    .limit(limite);
  if (error) throw error;
  // SAFE-CAST: el join anidado de PostgREST no se refleja en los tipos generados;
  // las columnas provienen de SELECT_COLS_ENTRANTES y se validan en el dominio.
  return (data ?? []) as unknown as FacturaEntranteRow[];
}

/**
 * v13.365.0 — Historial del buzón por estado (`capturada` / `rechazada`).
 * Se usa en las pestañas de sólo lectura de `/compras/buzon`.
 */
export async function listarFacturasEntrantesPorEstado(
  estado: "por_capturar" | "capturada" | "rechazada",
  limite = 200,
): Promise<FacturaEntranteRow[]> {
  const { data, error } = await supabase
    .from("embarque_facturas_entrantes")
    .select(SELECT_COLS_ENTRANTES)
    .eq("estado", estado)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (error) throw error;
  // SAFE-CAST: el join anidado de PostgREST no se refleja en los tipos generados;
  // las columnas provienen de SELECT_COLS_ENTRANTES y se validan en el dominio.
  return (data ?? []) as unknown as FacturaEntranteRow[];
}

/**
 * v13.359.0 — Abre el archivo del buzón sin navegar al dominio del backend.
 *
 * Algunas extensiones (adblockers, DNS filtering corporativo) bloquean la
 * navegación directa al dominio del backend con `ERR_BLOCKED_BY_CLIENT`. Por eso
 * el archivo se descarga como Blob y se abre desde una URL local (`blob:`); si el
 * navegador bloquea la pestaña, se cae a una descarga normal.
 */
export async function abrirFacturaEntrante(
  path: string,
  nombreArchivo: string,
): Promise<void> {
  const { data, error } = await supabase.storage.from(BUCKET_CXP_INBOX).download(path);
  if (error) throw error;
  // El XML no se renderiza en el navegador: se descarga directo.
  if (path.toLowerCase().endsWith(".xml")) {
    descargarBlob(data, nombreArchivo);
    return;
  }
  const blobUrl = crearUrlPdf(data);
  const ventana = window.open(blobUrl, "_blank", "noopener,noreferrer");
  if (!ventana) {
    descargarBlob(data, nombreArchivo);
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

/**
 * v13.365.0 — URL local (`blob:`) para la vista previa embebida del buzón.
 * El consumidor debe liberar la URL con `URL.revokeObjectURL` al cerrarla.
 */
export async function urlPreviaFacturaEntrante(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from(BUCKET_CXP_INBOX).download(path);
  if (error) throw error;
  // El Blob del almacenamiento suele venir como `application/octet-stream`;
  // sin la etiqueta `application/pdf` Chrome bloquea el visor incrustado.
  return crearUrlPdf(data);
}

export async function eliminarFacturaEntrante(
  row: Pick<FacturaEntranteRow, "id" | "archivo_path" | "xml_path">,
) {
  const { error } = await supabase
    .from("embarque_facturas_entrantes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", row.id);
  if (error) throw error;
  const paths = [row.archivo_path, row.xml_path].filter((p): p is string => Boolean(p));
  await supabase.storage.from(BUCKET_CXP_INBOX).remove(paths);
}

/**
 * Nombre legible del documento del buzón para la bitácora. Nunca lanza: el
 * registro es accesorio y no debe tumbar la captura/rechazo de la factura.
 */
async function folioDocumentoEntrante(documentoId: string): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("embarque_facturas_entrantes")
      .select("folio_detectado, nombre_archivo")
      .eq("id", documentoId)
      .maybeSingle();
    return data?.folio_detectado ?? data?.nombre_archivo ?? null;
  } catch {
    return null;
  }
}

export async function rechazarFacturaEntrante(documentoId: string, motivo: string) {
  const folio = await folioDocumentoEntrante(documentoId);
  const { error } = await supabase.rpc("rechazar_factura_entrante", {
    p_documento_id: documentoId,
    p_motivo: motivo,
  });
  if (error) throw error;
  await registrarActividad({
    modulo: "cxp",
    accion: "Rechazó factura entrante",
    entidadId: documentoId,
    entidadNombre: folio,
    detalles: { motivo },
  });
}

export async function capturarFacturaEntrante(documentoId: string, facturaId: string) {
  const folio = await folioDocumentoEntrante(documentoId);
  const { error } = await supabase.rpc("capturar_factura_entrante", {
    p_documento_id: documentoId,
    p_factura_id: facturaId,
  });
  if (error) throw error;
  await registrarActividad({
    modulo: "cxp",
    accion: "Capturó factura entrante",
    entidadId: facturaId,
    entidadNombre: folio,
    detalles: { documento_id: documentoId },
  });
}
