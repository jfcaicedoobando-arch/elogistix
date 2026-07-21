/**
 * Storage de CFDI para CxP — sube XML/PDF y actualiza URLs en proveedor_facturas.
 * v13.303.99: soporta caso PDF-only (facturas de proveedores internacionales
 * extraídas por IA) cuando `xmlFile` es null.
 */
import { supabase } from "@/integrations/supabase/client";
import { sanitizeFileName } from "@/lib/storage";

interface SubirArchivosParams {
  facturaId: string;
  organizationId: string | null | undefined;
  xmlFile: File | null;
  pdfFile: File | null;
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
