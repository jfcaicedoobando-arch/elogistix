import { describe, expect, it } from "vitest";
import { ReporteCarteraDocument, type FilaFacturaPdf, type BloqueCarteraPdf } from "../../src/pdf/documents/ReporteCarteraDocument";
import { carteraPdfPages, carteraRowCanFlow } from "../../src/pdf/documents/carteraPagination";
import { inspectPdf } from "./inspectPdf";
import { pdfWordBounds } from "./inspectPdfLayout";

const bounds = [[41, 165], [175, 227], [237, 293], [303, 355], [365, 381],
  [391, 435], [445, 514], [524, 593], [603, 672], [682, 751]];
const compact = (text: string) => text.normalize("NFD").replace(/\s/gu, "");
const names = [
  "Compañía Águila México Γειά σου κόσμε Логистика",
  "W".repeat(90),
  "Transportación logística internacional y consolidación de carga marítima aérea terrestre ".repeat(3),
];
function rows(count: number): FilaFacturaPdf[] {
  return Array.from({ length: count }, (_, index) => ({
    contraparte: `${names[index % names.length]} ${index + 1}`,
    folio: `QA-${String(index + 1).padStart(5, "0")}`, expediente: `EX${String(index + 1).padStart(6, "0")}`,
    vencimiento: "12/10/2026", dias: "1", bucket: "1-30 días", moneda: ["MXN", "USD", "EUR"][index % 3],
    saldo: "1234567.89", mxnHistorico: "1234567.89", mxnCorte: "1234000.00", diferencia: "-567.89",
  }));
}
function block(title: string, facturas: FilaFacturaPdf[]): BloqueCarteraPdf {
  return { titulo: title, facturas, totales: [{ etiqueta: `Total ${title}`, conteo: String(facturas.length),
    mxnHistorico: "1234567.89", mxnCorte: "1234000.00", diferencia: "-567.89" }] };
}
function document(blocks: BloqueCarteraPdf[]) {
  return <ReporteCarteraDocument fechaCorte="2026-10-12" leyendaTc="TC USD/MXN 18.1128"
    leyendaValuacion="Valuación multimoneda de prueba" busqueda="Prueba Unicode"
    emisor={{ organizacionNombre: "Compañía sintética México" }} bloques={blocks} />;
}
function assertContent(name: string, invoices: FilaFacturaPdf[], pages: number) {
  const words = pdfWordBounds(name);
  const markers = invoices.map((row) => {
    const matches = words.filter((word) => word.text === row.folio);
    expect(matches, row.folio).toHaveLength(1);
    return matches[0];
  });
  const headers = new Map<number, number>();
  for (const word of words) if (word.text === "Folio") headers.set(word.page, word.yMin);
  for (const word of words.filter((item) => item.yMin < 570)) expect(word.yMax).toBeLessThanOrEqual(556.1);
  for (let page = 0; page < pages; page += 1) {
    const text = words.filter((word) => word.page === page).map((word) => word.text).join(" ");
    expect(text).toContain(`Página ${page + 1} de ${pages}`);
  }
  invoices.forEach((row, index) => {
    const start = markers[index];
    const end = markers[index + 1];
    const body = words.filter((word) => word.yMin >= (headers.get(word.page) ?? Infinity) + 25
      && word.yMax < 556.1
      && (word.page > start.page || word.page === start.page && word.yMin >= start.yMin - 0.1)
      && (!end || word.page < end.page || word.page === end.page && word.yMax < end.yMin));
    const expected = [row.contraparte, row.folio, row.expediente, row.vencimiento, row.dias, row.bucket,
      `${row.moneda} 1,234,567.89`, "MXN 1,234,567.89", "MXN 1,234,000.00", "MXN -567.89"];
    bounds.forEach(([left, right], column) => {
      const cell = body.filter((word) => word.xMin >= left - 0.1 && word.xMin < right)
        .sort((a, b) => a.page - b.page || (Math.abs(a.yMin - b.yMin) > 0.5 ? a.yMin - b.yMin : a.xMin - b.xMin));
      for (const word of cell) expect(word.xMax).toBeLessThanOrEqual(right + 0.1);
      expect(compact(cell.map((word) => word.text).join("")), `${row.folio} column ${column}`).toBe(compact(expected[column]));
    });
  });
}

describe("Cartera bounded pagination", () => {
  it("preserves order, totals and inputs at the 100-row boundary", () => {
    const input = [block("CxC", rows(101)), block("CxP", [])];
    const before = JSON.stringify(input);
    const pages = carteraPdfPages(input);
    expect(pages).toHaveLength(3);
    expect(pages.flat().flatMap((part) => part.bloque.facturas)).toEqual(input[0].facturas);
    expect(pages.flat().filter((part) => !part.continuation).map((part) => part.bloque.totales)).toEqual(input.map((part) => part.totales));
    expect(JSON.stringify(input)).toBe(before);
    expect(carteraPdfPages([block("CxC", rows(100))])).toHaveLength(1);
  });

  it("preserves varying Unicode rows and currencies across batches and both blocks", async () => {
    const invoices = rows(121);
    const blocks = [block("CxC", invoices.slice(0, 101)), block("CxP", invoices.slice(101))];
    const before = JSON.stringify(blocks);
    const name = "cartera-batches-unicode";
    const pdf = await inspectPdf(name, document(blocks));
    assertContent(name, invoices, pdf.pages);
    expect(pdf.text.match(/Total CxC/g)).toHaveLength(1);
    expect(pdf.text.match(/Total CxP/g)).toHaveLength(1);
    expect(pdf.text).toContain("Valuación multimoneda de prueba");
    expect(pdf.text).toContain("Filtro de búsqueda: Prueba Unicode");
    expect(JSON.stringify(blocks)).toBe(before);
  });

  it("lets a single exceptionally tall row flow without losing its tail", async () => {
    const invoices = rows(2);
    invoices[0].contraparte = "W".repeat(1000) + " FIN-Ñ";
    expect(carteraRowCanFlow(invoices[0])).toBe(true);
    const name = "cartera-batches-tall-row";
    const pdf = await inspectPdf(name, document([block("CxP", invoices)]));
    expect(pdf.pages).toBeGreaterThan(2);
    assertContent(name, invoices, pdf.pages);
  });
});
