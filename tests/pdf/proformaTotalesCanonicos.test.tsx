import { describe, expect, it } from "vitest";
import { ProformaDocument } from "@/pdf/documents/ProformaDocument";
import { ProformaConsolidadaDocument } from "@/pdf/documents/ProformaConsolidadaDocument";
import { inspectPdf } from "./inspectPdf";
import { concepto, embarque, emisor, proforma } from "./fixtures";

const redondeo = { ...proforma, subtotal_usd: 0, iva_usd: 0, total_usd: 0,
  subtotal_mxn: 3066.66, iva_mxn: 490.6656, total_mxn: 3557.3256 };
const filas = [concepto(1, { precio_unitario: 1533.33 }), concepto(2, { precio_unitario: 1533.33 })];

describe("PDF real: proformas conservan totales por línea y divisa", () => {
  it("caja simple coincide con filas, no con el redondeo global guardado", async () => {
    const pdf = await inspectPdf("proforma-totales-linea", <ProformaDocument proforma={redondeo} embarque={embarque} conceptos={filas} emisor={emisor} />);
    expect(pdf.text.match(/MXN 245\.33/g)).toHaveLength(2);
    expect(pdf.text.match(/MXN 1,778\.66/g)).toHaveLength(2);
    expect(pdf.text).toContain("Subtotal MXN 3,066.66 IVA MXN 490.66 Total MXN 3,557.32");
    expect(pdf.text).not.toContain("3,557.33");
  });

  it("no duplica el equivalente USD en el total documental MXN", async () => {
    const historico = { ...proforma, subtotal_usd: 3156.75, iva_usd: 0, total_usd: 3156.75,
      subtotal_mxn: 61638.15, iva_mxn: 1152, total_mxn: 62790.15 };
    const conceptos = [concepto(1, { moneda: "USD", precio_unitario: 3156.75, tipo_iva: "no_objeto", aplica_iva: false }), concepto(2, { precio_unitario: 7200 })];
    const pdf = await inspectPdf("proforma-totales-divisas", <ProformaDocument proforma={historico} embarque={embarque} conceptos={conceptos} emisor={emisor} />);
    expect(pdf.text).toContain("Subtotal USD 3,156.75 Total USD 3,156.75");
    expect(pdf.text).toContain("Subtotal MXN 7,200.00 IVA MXN 1,152.00 Total MXN 8,352.00");
    expect(pdf.text).not.toContain("62,790.15");
  });

  it("consolidada interpreta total visible como base más IVA y conserva el snapshot", async () => {
    const conceptosConsolidados = filas.map((fila) => ({ ...fila, proforma_id: proforma.id, total: 1533.33, iva: 245.3328, contenedor: "QA-A", tipo_contenedor: "40HC" }));
    const before = JSON.stringify(conceptosConsolidados);
    const pdf = await inspectPdf("proforma-consolidada-totales-linea", <ProformaConsolidadaDocument proforma={{ ...redondeo, es_consolidada: true }} embarque={embarque} conceptosConsolidados={conceptosConsolidados} emisor={emisor} />);
    expect(pdf.text.match(/MXN 1,778\.66/g)).toHaveLength(2);
    expect(pdf.text).toContain("Total del contenedor MXN: MXN 3,557.32");
    expect(pdf.text).toContain("Subtotal MXN 3,066.66 IVA MXN 490.66 Total MXN 3,557.32");
    expect(JSON.stringify(conceptosConsolidados)).toBe(before);
  });

  it("sin desglose conserva cabecera redondeada e identifica el respaldo", async () => {
    const pdf = await inspectPdf("proforma-totales-sin-desglose", <ProformaDocument proforma={redondeo} embarque={embarque} conceptos={[]} emisor={emisor} />);
    expect(pdf.text).toContain("Detalle de conceptos no disponible. Se conserva el importe guardado.");
    expect(pdf.text).toContain("Total MXN 3,557.33");
  });
});
