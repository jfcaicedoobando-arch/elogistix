/**
 * Storage de CFDI para CxP — sube XML/PDF y actualiza URLs en proveedor_facturas
 * y proveedor_notas_credito.
 * v13.307.5: agrega adjuntar/quitar por tipo desde el detalle (post-creación).
 * N50 (Ola 4): valida el contenido real del archivo y prefija el path con el
 * slot (xml-/pdf-) para que XML y PDF nunca compartan path.
 */
import { supabase } from "@/integrations/supabase/client";
import { extractFacturaPath } from "@/services/storage/facturas";
export { subirArchivosNcProveedor } from "@/features/cxp/services/cfdiStorageNc";
export { resolverOrganizationId } from "@/features/cxp/services/cfdiOrg";
export type { TipoAdjuntoCfdi } from "@/features/cxp/services/cfdiValidation";
import { resolverOrganizationId } from "@/features/cxp/services/cfdiOrg";
import {
  contentTypeFor,
  pathCfdi,
  validarContenidoCfdi,
  type TipoAdjuntoCfdi,
} from "@/features/cxp/services/cfdiValidation";

interface SubirArchivosParams {
  facturaId: string;
  organizationId: string | null | undefined;
  xmlFile: File | null;
  pdfFile: File | null;
}

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

export async function subirArchivosCfdiFactura(params: SubirArchivosParams): Promise<void> {
  // 13.114.14: el primer segmento DEBE ser el organization_id para satisfacer
  // la política RLS del bucket `facturas` (`foldername(name)[1] = org_id`).
  const base = `${await resolverOrganizationId(params.organizationId)}/cfdi/${params.facturaId}`;
  const update: { archivo_xml_url?: string | null; archivo_pdf_url?: string | null } = {};
  const subidos: string[] = [];

  try {
    if (params.xmlFile) {
      await validarContenidoCfdi("XML", params.xmlFile);
      const xmlPath = pathCfdi(base, "XML", params.xmlFile.name);
      const xmlUp = await supabase.storage.from("facturas").upload(xmlPath, params.xmlFile, {
        contentType: "application/xml", upsert: true,
      });
      if (xmlUp.error) throw xmlUp.error;
      subidos.push(xmlPath);
      update.archivo_xml_url = xmlPath;
    }

    if (params.pdfFile) {
      await validarContenidoCfdi("PDF", params.pdfFile);
      const pdfPath = pathCfdi(base, "PDF", params.pdfFile.name);
      const pdfUp = await supabase.storage.from("facturas").upload(pdfPath, params.pdfFile, {
        contentType: "application/pdf", upsert: true,
      });
      if (pdfUp.error) throw pdfUp.error;
      subidos.push(pdfPath);
      update.archivo_pdf_url = pdfPath;
    }

    if (Object.keys(update).length === 0) return;

    const { error } = await supabase.from("proveedor_facturas").update(update).eq("id", params.facturaId);
    if (error) throw error;
  } catch (e) {
    // N50 (Ola 4): cleanup — archivos subidos sin renglón que los referencie
    // quedaban huérfanos si fallaba el segundo upload o el UPDATE.
    if (subidos.length > 0) {
      await supabase.storage.from("facturas").remove(subidos).catch(() => undefined);
    }
    throw e;
  }
}

/**
 * v13.307.5 — Adjunta o reemplaza un XML/PDF en una factura de proveedor ya
 * creada. Mantiene el prefijo `{organization_id}/cfdi/{facturaId}/…` para
 * cumplir la RLS del bucket `facturas`. `upsert: true` permite reemplazar
 * el archivo existente sin colisionar.
 */
export async function adjuntarArchivoCfdiFactura(params: AdjuntarArchivoParams): Promise<string> {
  // N50 (Ola 4): validar tipo real por slot antes de subir.
  await validarContenidoCfdi(params.tipo, params.file);
  const base = `${await resolverOrganizationId(params.organizationId)}/cfdi/${params.facturaId}`;
  // N50 (Ola 4): prefijo de slot en el path — XML y PDF nunca se pisan.
  const path = pathCfdi(base, params.tipo, params.file.name);
  const up = await supabase.storage.from("facturas").upload(path, params.file, {
    contentType: contentTypeFor(params.tipo),
    upsert: true,
  });
  if (up.error) throw up.error;

  const patch = params.tipo === "XML"
    ? { archivo_xml_url: path }
    : { archivo_pdf_url: path };
  const { error } = await supabase
    .from("proveedor_facturas")
    .update(patch)
    .eq("id", params.facturaId);
  if (error) {
    // N50 (Ola 4): cleanup del objeto recién subido si el UPDATE falla.
    await supabase.storage.from("facturas").remove([path]).catch(() => undefined);
    throw error;
  }

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

  const patch = params.tipo === "XML"
    ? { archivo_xml_url: null }
    : { archivo_pdf_url: null };
  const { error } = await supabase
    .from("proveedor_facturas")
    .update(patch)
    .eq("id", params.facturaId);
  if (error) throw error;

}
