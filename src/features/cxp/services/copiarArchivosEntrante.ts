/**
 * Copia los archivos del buzón CxP (`cxp-inbox`) al bucket `facturas` de la
 * factura de proveedor recién capturada, y escribe `archivo_pdf_url` /
 * `archivo_xml_url`.
 *
 * Sin esta copia la pestaña "Documentos" del detalle queda vacía aunque el
 * documento del buzón sí tenga los archivos (bug reportado en FP-000066).
 */
import { supabase } from "@/integrations/supabase/client";
import { BUCKET_CXP_INBOX } from "@/features/cxp/services/facturasEntrantes.types";
import { subirArchivosCfdiFactura } from "@/features/cxp/services/cfdiStorage";

interface CopiarParams {
  facturaId: string;
  organizationId: string | null | undefined;
  archivoPath: string | null;
  nombreArchivo: string | null;
  xmlPath: string | null;
  xmlNombre: string | null;
}

async function descargarComoFile(path: string, nombre: string): Promise<File> {
  const { data, error } = await supabase.storage.from(BUCKET_CXP_INBOX).download(path);
  if (error) throw error;
  const tipo = path.toLowerCase().endsWith(".xml") ? "application/xml" : "application/pdf";
  return new File([data], nombre, { type: tipo });
}

/** Copia PDF y XML del buzón a la factura. Devuelve cuántos archivos copió. */
export async function copiarArchivosEntranteAFactura(
  params: CopiarParams,
): Promise<number> {
  const esPdf = params.archivoPath && !params.archivoPath.toLowerCase().endsWith(".xml");
  const pdfFile = esPdf && params.archivoPath
    ? await descargarComoFile(params.archivoPath, params.nombreArchivo ?? "factura.pdf")
    : null;
  const xmlFile = params.xmlPath
    ? await descargarComoFile(params.xmlPath, params.xmlNombre ?? "factura.xml")
    : null;

  if (!pdfFile && !xmlFile) return 0;

  await subirArchivosCfdiFactura({
    facturaId: params.facturaId,
    organizationId: params.organizationId,
    xmlFile,
    pdfFile,
  });
  return (pdfFile ? 1 : 0) + (xmlFile ? 1 : 0);
}
