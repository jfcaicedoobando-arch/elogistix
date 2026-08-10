import { isoUtcDay } from "@/lib/date/mx";
import { supabase } from "@/integrations/supabase/client";

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
  return isoUtcDay(d);
}

/** Sube un archivo opcional al bucket privado `facturas`. Devuelve el path o null. */
async function uploadFacturaFile(
  file: File | null | undefined,
  path: string,
  contentType: string,
  label: string,
): Promise<string | null> {
  if (!file) return null;
  const { error: errUp } = await supabase.storage
    .from("facturas")
    .upload(path, file, { upsert: true, contentType });
  if (errUp) throw new Error(`Error al subir ${label}: ${errUp.message}`);
  return path;
}

interface BaseFactura {
  numero: string;
  proforma_id: string;
  embarque_id: string;
  cliente_id: string;
  cliente_nombre: string;
  expediente: string;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: "Emitida";
  factura_pdf_url: string | null;
  factura_xml_url: string | null;
  organization_id: string;
}

type FacturaAEmitir = BaseFactura & {
  moneda: "USD" | "MXN"; subtotal: number; iva: number; total: number;
  tipo_cambio: number | null;
};

/**
 * Construye la lista de facturas (USD/MXN) a insertar según los totales de la proforma.
 * v13.171.0 — TC explícito: MXN=1, extranjera=null (el usuario debe capturarlo
 * antes de timbrar; ver `FacturaDatosFiscalesCard`).
 */
function construirFacturasAEmitir(
  proforma: { total_usd: number | null; total_mxn: number | null; subtotal_usd: number | null; subtotal_mxn: number | null; iva_usd: number | null; iva_mxn: number | null },
  baseFactura: BaseFactura,
): FacturaAEmitir[] {
  const out: FacturaAEmitir[] = [];
  if (Number(proforma.total_usd) > 0) {
    out.push({ ...baseFactura, moneda: "USD", subtotal: Number(proforma.subtotal_usd), iva: Number(proforma.iva_usd), total: Number(proforma.total_usd), tipo_cambio: null });
  }
  if (Number(proforma.total_mxn) > 0) {
    out.push({ ...baseFactura, moneda: "MXN", subtotal: Number(proforma.subtotal_mxn), iva: Number(proforma.iva_mxn), total: Number(proforma.total_mxn), tipo_cambio: 1 });
  }
  return out;
}

const ERR_TOTAL_CERO =
  "LC_PROFORMA_TOTAL_CERO: la proforma no tiene importes mayores a cero; corrige los conceptos antes de marcarla como facturada.";

/** Valida que la proforma tenga importes antes de subir archivos a storage. */
function assertImportes(proforma: { total_usd: number | null; total_mxn: number | null }): void {
  if (Number(proforma.total_usd) <= 0 && Number(proforma.total_mxn) <= 0) {
    throw new Error(ERR_TOTAL_CERO);
  }
}

/** Inserta las facturas y devuelve los IDs (primaria y secundaria). */
async function insertarFacturas(
  facturasACrear: FacturaAEmitir[],
): Promise<{ primera: string | null; segunda: string | null }> {
  if (facturasACrear.length === 0) throw new Error(ERR_TOTAL_CERO);
  const { data, error } = await supabase.from("facturas").insert(facturasACrear).select("id");
  if (error) {
    // N16 (Ola 4): el índice único parcial uq_facturas_proforma_moneda_viva
    // resuelve la carrera del doble clic en el INSERT (atómico multi-fila):
    // el perdedor recibe 23505 y NINGUNA de sus facturas queda insertada
    // (antes quedaban huérfanas en estado "Emitida" y cobrables en CxC).
    if (error.code === "23505") {
      throw new Error(
        "LC_PROFORMA_YA_FACTURADA: otro usuario marcó esta proforma como facturada; recarga la página para ver la factura vigente.",
      );
    }
    throw new Error(`Error al crear factura: ${error.message}`);
  }
  return { primera: data?.[0]?.id ?? null, segunda: data?.[1]?.id ?? null };
}

/**
 * Marca la proforma como facturada con guard de idempotencia en BD.
 * A5: el perdedor de una carrera no debe reportar éxito (0 filas afectadas).
 */
async function persistirFacturacion(
  params: MarcarFacturadaParams,
  ids: { primera: string | null; segunda: string | null },
): Promise<void> {
  const { data, error } = await supabase
    .from("proformas")
    .update({
      estado_proforma: "facturada",
      folio_factura_externa: params.folioFacturaExterna,
      fecha_facturacion: params.fechaFacturacion,
      factura_id: ids.primera,
      factura_secundaria_id: ids.segunda,
    })
    .eq("id", params.proformaId)
    .is("factura_id", null)
    .select("id");
  if (error) throw error;
  if (Array.isArray(data) && data.length !== 1) {
    throw new Error(
      "LC_PROFORMA_YA_FACTURADA: otro usuario marcó esta proforma como facturada; recarga la página para ver la factura vigente.",
    );
  }
}

/**
 * B-2: Marca una proforma como facturada de forma idempotente.
 * - Si la proforma ya tiene `factura_id`, no hace nada (retorno temprano).
 * - Cuando hay USD y MXN, crea dos facturas y persiste ambos IDs (`factura_id` + `factura_secundaria_id`).
 */
export async function marcarProformaFacturada(params: MarcarFacturadaParams): Promise<void> {
  const { data: proforma, error: errProf } = await supabase
    .from("proformas")
    .select("*")
    .eq("id", params.proformaId)
    // Nunca facturar una proforma que está en papelera.
    .is("deleted_at", null)
    .single();
  if (errProf) throw errProf;

  // Idempotencia: si ya fue facturada, salir sin tocar nada.
  if (proforma.factura_id) return;

  assertImportes(proforma);

  const basePath = `${proforma.organization_id}/${proforma.id}`;
  const pdfUrl = await uploadFacturaFile(params.pdfFile, `${basePath}/factura.pdf`, "application/pdf", "PDF");
  const xmlUrl = await uploadFacturaFile(params.xmlFile, `${basePath}/factura.xml`, "application/xml", "XML");

  const baseFactura = {
    numero: params.folioFacturaExterna,
    proforma_id: proforma.id,
    embarque_id: proforma.embarque_id!,
    cliente_id: proforma.cliente_id,
    cliente_nombre: proforma.cliente_nombre,
    expediente: proforma.expediente,
    fecha_emision: params.fechaFacturacion,
    fecha_vencimiento: addDays(params.fechaFacturacion, proforma.dias_credito ?? 0),
    estado: "Emitida" as const,
    factura_pdf_url: pdfUrl,
    factura_xml_url: xmlUrl,
    organization_id: proforma.organization_id,
  };

  const ids = await insertarFacturas(construirFacturasAEmitir(proforma, baseFactura));
  await persistirFacturacion(params, ids);
}
