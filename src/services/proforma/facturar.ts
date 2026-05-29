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
  return d.toISOString().slice(0, 10);
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
    .single();
  if (errProf) throw errProf;

  // Idempotencia: si ya fue facturada, salir sin tocar nada.
  if (proforma.factura_id) {
    return;
  }

  const basePath = `${proforma.organization_id}/${proforma.id}`;
  const pdfUrl = await uploadFacturaFile(params.pdfFile, `${basePath}/factura.pdf`, "application/pdf", "PDF");
  const xmlUrl = await uploadFacturaFile(params.xmlFile, `${basePath}/factura.xml`, "application/xml", "XML");

  const dias = proforma.dias_credito ?? 0;
  const fechaVencimiento = addDays(params.fechaFacturacion, dias);

  const baseFactura = {
    numero: params.folioFacturaExterna,
    proforma_id: proforma.id,
    embarque_id: proforma.embarque_id!,
    cliente_id: proforma.cliente_id,
    cliente_nombre: proforma.cliente_nombre,
    expediente: proforma.expediente,
    fecha_emision: params.fechaFacturacion,
    fecha_vencimiento: fechaVencimiento,
    estado: "Emitida" as const,
    factura_pdf_url: pdfUrl,
    factura_xml_url: xmlUrl,
    organization_id: proforma.organization_id,
  };

  const facturasACrear = construirFacturasAEmitir(proforma, baseFactura);

  let primeraFacturaId: string | null = null;
  let segundaFacturaId: string | null = null;
  if (facturasACrear.length > 0) {
    const { data: facturasCreadas, error: errFact } = await supabase
      .from("facturas")
      .insert(facturasACrear)
      .select("id");
    if (errFact) throw new Error(`Error al crear factura: ${errFact.message}`);
    primeraFacturaId = facturasCreadas?.[0]?.id ?? null;
    segundaFacturaId = facturasCreadas?.[1]?.id ?? null;
  }

  const { error: errUpd } = await supabase
    .from("proformas")
    .update({
      estado_proforma: "facturada",
      folio_factura_externa: params.folioFacturaExterna,
      fecha_facturacion: params.fechaFacturacion,
      factura_id: primeraFacturaId,
      factura_secundaria_id: segundaFacturaId,
    })
    // Guard de idempotencia a nivel DB: sólo escribir si sigue sin factura_id.
    .eq("id", params.proformaId)
    .is("factura_id", null);
  if (errUpd) throw errUpd;
}
