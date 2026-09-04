/**
 * N50 (Ola 4): subida de CFDI para notas de crédito de proveedor. Extraído
 * de cfdiStorage.ts para mantener el archivo principal ≤200 líneas.
 */
import { supabase } from "@/integrations/supabase/client";
import { pathCfdi, validarContenidoCfdi } from "@/features/cxp/services/cfdiValidation";
import { resolverOrganizationId } from "@/features/cxp/services/cfdiOrg";

interface SubirArchivosNcParams {
  ncId: string;
  organizationId: string | null | undefined;
  xmlFile: File | null;
  pdfFile: File | null;
}

export async function subirArchivosNcProveedor(params: SubirArchivosNcParams): Promise<void> {
  const base = `${await resolverOrganizationId(params.organizationId)}/nc/${params.ncId}`;
  const update: {
    archivo_xml_url?: string | null;
    archivo_pdf_url?: string | null;
  } = {};
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

    // Tanda 2 · hallazgo 3: nota viva + fila afectada; si no, la operación
    // falla y el `catch` limpia los objetos ya subidos.
    const { data: fila, error } = await supabase
      .from("proveedor_notas_credito")
      .update(update)
      .eq("id", params.ncId)
      .is("deleted_at", null)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    if (!fila) throw new Error("La nota de crédito no existe o fue eliminada: no se adjuntaron los archivos.");
  } catch (e) {
    // N50 (Ola 4): cleanup de objetos huérfanos (mismo patrón que facturas).
    if (subidos.length > 0) {
      await supabase.storage.from("facturas").remove(subidos).catch(() => undefined);
    }
    throw e;
  }
}

