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

export async function marcarProformaFacturada(params: MarcarFacturadaParams): Promise<void> {
  const { data: proforma, error: errProf } = await supabase
    .from("proformas")
    .select(
      "id, organization_id, embarque_id, cliente_id, cliente_nombre, expediente, dias_credito, subtotal_usd, iva_usd, total_usd, subtotal_mxn, iva_mxn, total_mxn",
    )
    .eq("id", params.proformaId)
    .single();
  if (errProf) throw errProf;

  let pdfUrl: string | null = null;
  let xmlUrl: string | null = null;
  const basePath = `${proforma.organization_id}/${proforma.id}`;

  if (params.pdfFile) {
    const path = `${basePath}/factura.pdf`;
    const { error: errUp } = await supabase.storage
      .from("facturas")
      .upload(path, params.pdfFile, { upsert: true, contentType: "application/pdf" });
    if (errUp) throw new Error(`Error al subir PDF: ${errUp.message}`);
    pdfUrl = supabase.storage.from("facturas").getPublicUrl(path).data.publicUrl;
  }
  if (params.xmlFile) {
    const path = `${basePath}/factura.xml`;
    const { error: errUp } = await supabase.storage
      .from("facturas")
      .upload(path, params.xmlFile, { upsert: true, contentType: "application/xml" });
    if (errUp) throw new Error(`Error al subir XML: ${errUp.message}`);
    xmlUrl = supabase.storage.from("facturas").getPublicUrl(path).data.publicUrl;
  }

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

  const facturasACrear: Array<typeof baseFactura & {
    moneda: "USD" | "MXN"; subtotal: number; iva: number; total: number;
  }> = [];
  if (Number(proforma.total_usd) > 0) {
    facturasACrear.push({
      ...baseFactura, moneda: "USD",
      subtotal: Number(proforma.subtotal_usd),
      iva: Number(proforma.iva_usd),
      total: Number(proforma.total_usd),
    });
  }
  if (Number(proforma.total_mxn) > 0) {
    facturasACrear.push({
      ...baseFactura, moneda: "MXN",
      subtotal: Number(proforma.subtotal_mxn),
      iva: Number(proforma.iva_mxn),
      total: Number(proforma.total_mxn),
    });
  }

  let primeraFacturaId: string | null = null;
  if (facturasACrear.length > 0) {
    const { data: facturasCreadas, error: errFact } = await supabase
      .from("facturas")
      .insert(facturasACrear)
      .select("id");
    if (errFact) throw new Error(`Error al crear factura: ${errFact.message}`);
    primeraFacturaId = facturasCreadas?.[0]?.id ?? null;
  }

  const { error: errUpd } = await supabase
    .from("proformas")
    .update({
      estado_proforma: "facturada",
      folio_factura_externa: params.folioFacturaExterna,
      fecha_facturacion: params.fechaFacturacion,
      factura_id: primeraFacturaId,
    })
    .eq("id", params.proformaId);
  if (errUpd) throw errUpd;
}
