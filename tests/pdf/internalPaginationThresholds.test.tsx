import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ProformaDocument } from "@/pdf/documents/ProformaDocument";
import { LibroPagosDocument, type FilaLibroPagosExport } from "@/pdf/documents/LibroPagosDocument";
import { inspectPdf } from "./inspectPdf";
import { pdfWordBounds } from "./inspectPdfLayout";
import { concepto, embarque, proforma, emisor } from "./fixtures";

beforeEach(() => { vi.useFakeTimers({ toFake: ["Date"] }); vi.setSystemTime(new Date("2026-10-11T12:00:00Z")); });
afterEach(() => { vi.useRealTimers(); });

function checkGeometry(name: string, pages: number) {
  const words = pdfWordBounds(name);
  for (let page = 0; page < pages; page++) {
    const footer = words.find(word => word.page === page && word.text === "Página");
    expect(footer).toBeDefined();
    // Content is above the reserved footer; its own neighbouring words share the baseline.
    const content = words.filter(word => word.page === page && word.yMin < footer!.yMin - 3);
    expect(content.length).toBeGreaterThan(0);
    expect(content.every(word => word.yMax < footer!.yMin - 2)).toBe(true);
  }
  return words;
}

describe("Real renderer at bounded grouping thresholds", () => {
  it.each([19, 20])("proforma preserves %i explicit lines at the 276/290pt boundary", async (lines) => {
    const markers = Array.from({ length: lines }, (_, i) => `P${String(i + 1).padStart(2, "0")}`);
    const name = `integration-proforma-threshold-${lines}`;
    const rows = [concepto(1, { descripcion: markers.join("\n"), cantidad: 2, precio_unitario: 123.45, total: 246.9 })];
    const input = JSON.stringify(rows);
    const pdf = await inspectPdf(name, <ProformaDocument emisor={emisor} embarque={embarque}
      proforma={{ ...proforma, subtotal_usd: 0, total_usd: 0, iva_usd: 0, subtotal_mxn: 246.9, iva_mxn: 39.5, total_mxn: 286.4 }} conceptos={rows} />);
    for (const marker of markers) expect(pdf.text.match(new RegExp(`\\b${marker}\\b`, "g"))).toHaveLength(1);
    for (const text of ["MXN 123.45", "MXN 246.90", "MXN 286.40"]) expect(pdf.text).toContain(text);
    expect(JSON.stringify(rows)).toBe(input);
    const words = checkGeometry(name, pdf.pages);
    const headings = words.filter(word => word.text === "Conceptos");
    expect(headings).toHaveLength(1);
    expect(words.find(word => word.text === "P01")?.page).toBe(headings[0].page);
    if (lines === 19) expect(words.find(word => word.text === "P19")?.page).toBe(words.find(word => word.text === "Subtotal")?.page);
  });

  it.each([12, 13])("payment preserves %i explicit lines and its five closing cards", async (lines) => {
    const markers = Array.from({ length: lines }, (_, i) => `R${String(i + 1).padStart(2, "0")}`);
    const base: FilaLibroPagosExport = { fecha: "11/10/2026", tipo: "Pago", contraparte: "QA", documento: "FP-001",
      metodo: "03", referencia: "REF", cuenta: "QA", monto: "USD 73.21", tipoCambio: "18.7654", fuenteTc: "Guardado", montoMxn: "MXN 1,373.82", estado: "Pendiente" };
    const filas = [...Array.from({ length: 8 }, (_, i) => ({ ...base, documento: `PRE-${i + 1}`, referencia: `A${i + 1}` })),
      { ...base, documento: "FP-LAST", referencia: markers.join("\n"), monto: "USD 91.23", montoMxn: "MXN 1,711.97" }];
    const input = JSON.stringify(filas);
    const name = `integration-payment-threshold-${lines}`;
    const pdf = await inspectPdf(name, <LibroPagosDocument emisor={emisor} filas={filas}
      resumen={{ periodo: "Octubre 2026", cobrado: "MXN 0.00", pagado: "MXN 12,702.53", devuelto: "MXN 0.00", neto: "MXN -12,702.53", conteo: "9" }} />);
    for (const marker of markers) expect(pdf.text.match(new RegExp(`\\b${marker}\\b`, "g"))).toHaveLength(1);
    for (let i = 1; i <= 8; i++) expect(pdf.text.match(new RegExp(`\\bPRE-${i}\\b`, "g"))).toHaveLength(1);
    expect(pdf.text.match(/FP-LAST/g)).toHaveLength(1);
    expect(pdf.text.match(/18\.7654/g)).toHaveLength(9);
    for (const text of ["USD 91.23", "MXN 1,711.97", "TOTAL PAGADO (MXN): MXN 12,702.53"]) expect(pdf.text).toContain(text);
    expect(JSON.stringify(filas)).toBe(input);
    const words = checkGeometry(name, pdf.pages);
    const summary = words.filter(word => ["TOTAL", "DEVOLUCIONES", "NETO", "INCLUIDOS:"].includes(word.text));
    expect(summary.length).toBeGreaterThanOrEqual(5);
    expect(new Set(summary.map(word => word.page)).size).toBe(1);
    if (lines === 12) expect(words.find(word => word.text === "R12")?.page).toBe(summary[0].page);
    const last = words.find(word => word.text === "FP-LAST");
    expect(last).toBeDefined();
    for (const amount of ["91.23", "1,711.97"]) {
      const hit = words.filter(word => word.text === amount);
      expect(hit).toHaveLength(1);
      expect(hit[0].page).toBe(last!.page);
      expect(Math.abs(hit[0].yMin - last!.yMin)).toBeLessThan(16);
    }
  });
});
