/**
 * Storage de CFDI para CxP — sube XML/PDF y actualiza URLs en proveedor_facturas
 * y proveedor_notas_credito.
 * v13.307.5: agrega adjuntar/quitar por tipo desde el detalle (post-creación).
 */
import { supabase } from "@/integrations/supabase/client";
import { sanitizeFileName } from "@/lib/storage";
import { extractFacturaPath } from "@/services/storage/facturas";

interface SubirArchivosParams {
  facturaId: string;
  organizationId: string | null | undefined;
  xmlFile: File | null;
  pdfFile: File | null;
}

interface SubirArchivosNcParams {
  ncId: string;
  organizationId: string | null | undefined;
  xmlFile: File | null;
  pdfFile: File | null;
}

export type TipoAdjuntoCfdi = "XML" | "PDF";

interface AdjuntarArchivoParams {
  facturaId: string;
  organizationId: string | null | undefined;
  tipo: TipoAdjuntoCfdi;
  file: File;
}

interface QuitarArchivoParams {
  facturaId: string;
  path: string;
  tipo: TipoAdjuntoCfdi;
}

function contentTypeFor(tipo: TipoAdjuntoCfdi): string {
  return tipo === "XML" ? "application/xml" : "application/pdf";
}

function columnFor(tipo: TipoAdjuntoCfdi): "archivo_xml_url" | "archivo_pdf_url" {
  return tipo === "XML" ? "archivo_xml_url" : "archivo_pdf_url";
}

export async function subirArchivosCfdiFactura(params: SubirArchivosParams): Promise<void> {
  // 13.114.14: el primer segmento DEBE ser el organization_id para satisfacer
  // la política RLS del bucket `facturas` (`foldername(name)[1] = org_id`).
  const base = `${params.organizationId ?? "org"}/cfdi/${params.facturaId}`;
  const update: { archivo_xml_url?: string | null; archivo_pdf_url?: string | null } = {};

  if (params.xmlFile) {
    const xmlPath = `${base}/${sanitizeFileName(params.xmlFile.name)}`;
    const xmlUp = await supabase.storage.from("facturas").upload(xmlPath, params.xmlFile, {
      contentType: "application/xml", upsert: true,
    });
    if (xmlUp.error) throw xmlUp.error;
    update.archivo_xml_url = xmlPath;
  }

  if (params.pdfFile) {
    const pdfPath = `${base}/${sanitizeFileName(params.pdfFile.name)}`;
    const pdfUp = await supabase.storage.from("facturas").upload(pdfPath, params.pdfFile, {
      contentType: "application/pdf", upsert: true,
    });
    if (pdfUp.error) throw pdfUp.error;
    update.archivo_pdf_url = pdfPath;
  }

  if (Object.keys(update).length === 0) return;

  const { error } = await supabase.from("proveedor_facturas").update(update).eq("id", params.facturaId);
  if (error) throw error;
}

export async function subirArchivosNcProveedor(params: SubirArchivosNcParams): Promise<void> {
  const base = `${params.organizationId ?? "org"}/nc/${params.ncId}`;
  const update: {
    archivo_xml_url?: string | null;
    archivo_pdf_url?: string | null;
  } = {};

  if (params.xmlFile) {
    const xmlPath = `${base}/${sanitizeFileName(params.xmlFile.name)}`;
    const xmlUp = await supabase.storage.from("facturas").upload(xmlPath, params.xmlFile, {
      contentType: "application/xml", upsert: true,
    });
    if (xmlUp.error) throw xmlUp.error;
    update.archivo_xml_url = xmlPath;
  }

  if (params.pdfFile) {
    const pdfPath = `${base}/${sanitizeFileName(params.pdfFile.name)}`;
    const pdfUp = await supabase.storage.from("facturas").upload(pdfPath, params.pdfFile, {
      contentType: "application/pdf", upsert: true,
    });
    if (pdfUp.error) throw pdfUp.error;
    update.archivo_pdf_url = pdfPath;
  }

  if (Object.keys(update).length === 0) return;

  const { error } = await supabase
    .from("proveedor_notas_credito")
    .update(update)
    .eq("id", params.ncId);
  if (error) throw error;
}

/**
 * v13.307.5 — Adjunta o reemplaza un XML/PDF en una factura de proveedor ya
 * creada. Mantiene el prefijo `{organization_id}/cfdi/{facturaId}/…` para
 * cumplir la RLS del bucket `facturas`. `upsert: true` permite reemplazar
 * el archivo existente sin colisionar.
 */
export async function adjuntarArchivoCfdiFactura(params: AdjuntarArchivoParams): Promise<string> {
  const base = `${params.organizationId ?? "org"}/cfdi/${params.facturaId}`;
  const path = `${base}/${sanitizeFileName(params.file.name)}`;
  const up = await supabase.storage.from("facturas").upload(path, params.file, {
    contentType: contentTypeFor(params.tipo),
    upsert: true,
  });
  if (up.error) throw up.error;

  const { error } = await supabase
    .from("proveedor_facturas")
    .update({ [columnFor(params.tipo)]: path })
    .eq("id", params.facturaId);
  if (error) throw error;

  return path;
}

/**
 * v13.307.5 — Elimina el objeto del bucket (best-effort) y limpia la columna
 * `archivo_xml_url` o `archivo_pdf_url` de la factura. Si el archivo ya no
 * existía físicamente igualmente se limpia la referencia en BD.
 */
export async function quitarArchivoCfdiFactura(params: QuitarArchivoParams): Promise<void> {
  const cleanPath = extractFacturaPath(params.path);
  // No revertimos si el remove falla: el archivo puede estar ya borrado.
  await supabase.storage.from("facturas").remove([cleanPath]).catch(() => undefined);

  const { error } = await supabase
    .from("proveedor_facturas")
    .update({ [columnFor(params.tipo)]: null })
    .eq("id", params.facturaId);
  if (error) throw error;
}
