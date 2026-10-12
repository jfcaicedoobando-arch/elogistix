import { describe, expect, it, vi } from "vitest";
import { ProformaDocument } from "@/pdf/documents/ProformaDocument";
import { LibroPagosDocument } from "@/pdf/documents/LibroPagosDocument";
import { inspectPdf } from "./inspectPdf";
import { pdfWordBounds } from "./inspectPdfLayout";
import { concepto, embarque, proforma, emisor } from "./fixtures";

function checkPages(pdf: Awaited<ReturnType<typeof inspectPdf>>) {
  for (let page = 1; page <= pdf.pages; page++) expect(pdf.text).toContain(`Página ${page} de ${pdf.pages}`);
  expect(pdf.text).not.toMatch(/undefined|NaN/);
}

describe("Descripciones y grupos altos fluyen sin recortes", () => {
  it.each([60, 80, 90, 100, 160, 300])("conserva completa una fila de %i palabras y todos sus pies", async (count) => {
    const warn = vi.spyOn(console, "warn");
    try {
      const pdf = await inspectPdf(`final-fila-alta-${count}`, <ProformaDocument emisor={emisor} embarque={embarque} proforma={proforma}
        conceptos={[concepto(1, { descripcion: `STARTROW ${"segmento ".repeat(count)} ENDROW` })]} />);
      expect(pdf.text.match(/STARTROW/g)).toHaveLength(1);
      expect(pdf.text.match(/ENDROW/g)).toHaveLength(1);
      expect(pdf.text.match(/segmento/g)).toHaveLength(count);
      expect(pdf.text).toContain("MXN 1,160.00");
      expect(pdf.text.match(/Subtotal/g)).toHaveLength(1);
      checkPages(pdf);
      expect(warn.mock.calls.flat().join(" ")).not.toContain("bigger than available page height");
    } finally { warn.mockRestore(); }
  });
  it.each([90, 160, 300])("conserva dos monedas con %i palabras por concepto", async (count) => {
    const pdf = await inspectPdf(`final-filas-altas-divisas-${count}`, <ProformaDocument emisor={emisor} embarque={embarque}
      proforma={{ ...proforma, subtotal_usd: 1000, iva_usd: 160, total_usd: 1160 }}
      conceptos={[concepto(1, { moneda: "USD", descripcion: `STARTUSD ${"dolares ".repeat(count)} ENDUSD` }), concepto(2, { descripcion: `STARTMXN ${"pesos ".repeat(count)} ENDMXN` })]} />);
    for (const marker of ["STARTUSD", "ENDUSD", "STARTMXN", "ENDMXN"]) expect(pdf.text.match(new RegExp(marker, "g"))).toHaveLength(1);
    expect(pdf.text.match(/dolares/g)).toHaveLength(count);
    expect(pdf.text.match(/pesos/g)).toHaveLength(count);
    for (const amount of ["USD 1,160.00", "MXN 1,160.00"]) expect(pdf.text).toContain(amount);
    expect(pdf.text.match(/Subtotal/g)).toHaveLength(2);
    checkPages(pdf);
  });
  it.each([26, 28, 60])("conserva todas las filas de un contenedor con %i conceptos", async (count) => {
    const conceptos = [concepto(1000, { descripcion: "FIRSTGROUP", embarque_contenedores: { id: "a", numero_contenedor: "DEMO0000001", tipo_contenedor: "40HC" } }),
      ...Array.from({ length: count }, (_, i) => concepto(i + 1, { descripcion: `ROW${String(i + 1).padStart(3, "0")} servicio por contenedor`, embarque_contenedores: { id: "b", numero_contenedor: "DEMO0000002", tipo_contenedor: "40HC" } }))];
    const pdf = await inspectPdf(`final-contenedor-alto-${count}`, <ProformaDocument emisor={emisor} embarque={embarque}
      proforma={{ ...proforma, subtotal_usd: 0, iva_usd: 0, total_usd: 0, subtotal_mxn: (count + 1) * 1000, iva_mxn: (count + 1) * 160, total_mxn: (count + 1) * 1160 }} conceptos={conceptos} />);
    for (let i = 1; i <= count; i++) expect(pdf.text.match(new RegExp(`\\bROW${String(i).padStart(3, "0")}\\b`, "g"))).toHaveLength(1);
    expect(pdf.text).toContain(`MXN ${((count + 1) * 1160).toLocaleString("en-US", { minimumFractionDigits: 2 })}`);
    const words = pdfWordBounds(`final-contenedor-alto-${count}`);
    const groupHeading = words.find(word => word.text === "DEMO0000002");
    const first = words.find(word => word.text === "ROW001");
    expect(groupHeading).toBeDefined();
    expect(first).toBeDefined();
    expect(groupHeading?.page).toBe(first?.page);
    const last = words.find(word => word.text === `ROW${String(count).padStart(3, "0")}`);
    const total = words.find(word => word.text === ((count + 1) * 1160).toLocaleString("en-US", { minimumFractionDigits: 2 }));
    expect(last).toBeDefined();
    expect(total).toBeDefined();
    expect(last?.page).toBe(total?.page);
    checkPages(pdf);
  });
  it.each([80, 200])("conserva una referencia de pago de %i palabras", async (count) => {
    const pdf = await inspectPdf(`final-pago-alto-${count}`, <LibroPagosDocument emisor={emisor}
      resumen={{ periodo: "Octubre 2026", cobrado: "MXN 0.00", pagado: "MXN 1.00", devuelto: "MXN 0.00", neto: "MXN -1.00", conteo: "1" }}
      filas={[{ fecha: "07/10/2026", tipo: "Pago", contraparte: "Proveedor", documento: "FP-1", metodo: "Transferencia", referencia: `STARTPAY ${"dato ".repeat(count)} ENDPAY`, cuenta: "Operativa", monto: "MXN 1.00", tipoCambio: "1.0000", fuenteTc: "Guardado", montoMxn: "MXN 1.00", estado: "Pendiente" }]} />);
    expect(pdf.text.match(/STARTPAY/g)).toHaveLength(1);
    expect(pdf.text.match(/ENDPAY/g)).toHaveLength(1);
    expect(pdf.text.match(/dato/g)).toHaveLength(count);
    expect(pdf.text).toContain("TOTAL PAGADO (MXN): MXN 1.00");
    const words = pdfWordBounds(`final-pago-alto-${count}`);
    const summaries = words.filter(word => ["TOTAL", "DEVOLUCIONES", "NETO", "INCLUIDOS:"].includes(word.text));
    expect(summaries.length).toBeGreaterThanOrEqual(5);
    expect(new Set(summaries.map(word => word.page)).size).toBe(1);
    checkPages(pdf);
  });
  it("conserva un identificador muy largo sin espacios", async () => {
    const longContainerIdentifier = "CONTENEDOR1234567890".repeat(60);
    const pdf = await inspectPdf("final-fila-token-largo", <ProformaDocument emisor={emisor} embarque={embarque} proforma={proforma}
      conceptos={[concepto(1, { descripcion: `TOKENSTART ${longContainerIdentifier} TOKENEND` })]} />);
    // Reassemble only the description cells: repeated page headers, other
    // columns and footers legitimately interrupt raw text extraction.
    const words = pdfWordBounds("final-fila-token-largo");
    const headers = words.filter(word => word.text === "Descripción");
    expect(headers).toHaveLength(pdf.pages - 1);
    expect(headers.map(header => header.page)).toEqual(Array.from({ length: pdf.pages - 1 }, (_, page) => page + 1));
    // Glyph bounds can extend below the content line box; retain the same
    // 6pt clearance above the footer rule (748pt) as the notes layout tests.
    const description = words.filter(word => word.xMin >= 40 && word.xMax <= 173 && word.yMax <= 742 &&
      word.yMin > (headers.find(header => header.page === word.page)?.yMin ?? Infinity) + 15)
      .map(word => word.text).join("");
    expect(description).toBe(`TOKENSTART${longContainerIdentifier}TOKENEND`);
    expect(pdf.text).toContain("TOKENEND");
    expect(pdf.text.match(/Subtotal/g)).toHaveLength(1);
    checkPages(pdf);
  });
  it("conserva las 120 líneas explícitas de una descripción", async () => {
    const lines = Array.from({ length: 120 }, (_, i) => `LINE${String(i + 1).padStart(3, "0")}`);
    const pdf = await inspectPdf("final-fila-lineas-explicitas", <ProformaDocument emisor={emisor} embarque={embarque} proforma={proforma}
      conceptos={[concepto(1, { descripcion: lines.join("\n") })]} />);
    for (const line of lines) expect(pdf.text.match(new RegExp(`\\b${line}\\b`, "g"))).toHaveLength(1);
    expect(pdf.text.match(/Subtotal/g)).toHaveLength(1);
    checkPages(pdf);
  });

});
