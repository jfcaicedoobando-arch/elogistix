/**
 * Storage de CFDI para CxP — sube XML/PDF y actualiza URLs en proveedor_facturas.
 * Separado de proveedorFacturas.ts para respetar el límite Power of 10.
 */
import { supabase } from "@/integrations/supabase/client";
import { sanitizeFileName } from "@/lib/storage";

export async function subirArchivosCfdiFactura(params: {
  facturaId: string;
  organizationId: string | null | undefined;
  xmlFile: File;
  pdfFile: File | null;
}): Promise<void> {
  // 13.114.14: el primer segmento DEBE ser el organization_id para satisfacer
  // la política RLS del bucket `facturas` (`foldername(name)[1] = org_id`).
  // Antes era `cfdi/<org>/<facturaId>` y RLS rechazaba el INSERT con 403.
  const base = `${params.organizationId ?? "org"}/cfdi/${params.facturaId}`;
  const xmlPath = `${base}/${sanitizeFileName(params.xmlFile.name)}`;
  const xmlUp = await supabase.storage.from("facturas").upload(xmlPath, params.xmlFile, {
    contentType: "application/xml", upsert: true,
  });
  if (xmlUp.error) throw xmlUp.error;

  let pdfPath: string | null = null;
  if (params.pdfFile) {
    pdfPath = `${base}/${sanitizeFileName(params.pdfFile.name)}`;
    const pdfUp = await supabase.storage.from("facturas").upload(pdfPath, params.pdfFile, {
      contentType: "application/pdf", upsert: true,
    });
    if (pdfUp.error) throw pdfUp.error;
  }

  const { error } = await supabase.from("proveedor_facturas").update({
    archivo_xml_url: xmlPath,
    archivo_pdf_url: pdfPath,
  }).eq("id", params.facturaId);
  if (error) throw error;
}
