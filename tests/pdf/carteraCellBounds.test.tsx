import { describe, expect, it } from "vitest";
import { ReporteCarteraDocument, type FilaFacturaPdf } from "@/pdf/documents/ReporteCarteraDocument";
import { inspectPdf } from "./inspectPdf";
import { pdfWordBounds } from "./inspectPdfLayout";
import { LEYENDA_VALUACION_EUR } from "@/features/reportes/cartera/domain/carteraLeyendas";

const fixture: FilaFacturaPdf = {
  contraparte: "AUTOTRANSPORTES RUTA ENCINO SA DE CV [AUD2-MOCK-20261012-P01]",
  folio: "FP-000043", expediente: "ELNAC00030", vencimiento: "04/10/2026",
  dias: "8", bucket: "1-30 días", moneda: "MXN", saldo: "27566.00",
  mxnHistorico: "27566.00", mxnCorte: "27566.00", diferencia: "0.00",
};
const compact = (text: string) => text.normalize("NFD").replace(/\s/gu, "");

// LETTER landscape: 792pt minus two 36pt margins. Each bound includes the
// real 5pt cell padding; extraction alone also returns invisible clipped text.
const bounds = [[41, 165], [175, 227], [237, 293], [303, 355], [365, 381],
  [391, 435], [445, 514], [524, 593], [603, 672], [682, 751]];

function document(rows: FilaFacturaPdf[]) {
  return <ReporteCarteraDocument fechaCorte="2026-10-12" leyendaTc="TC DOF USD/MXN 18.4163"
    leyendaValuacion={LEYENDA_VALUACION_EUR}
    emisor={{ organizacionNombre: "Empresa sintética QA" }} bloques={[{
      titulo: "Cuentas por pagar", totales: [], facturas: rows,
    }]} />;
}

function assertRow(name: string, row: FilaFacturaPdf, index: number, rows: FilaFacturaPdf[]) {
  const words = pdfWordBounds(name);
  const marker = words.find(w => w.text === row.folio)!;
  expect(marker).toBeDefined();
  const next = words.find(w => w.text === rows[index + 1]?.folio);
  const body = words.filter(w => w.page === marker.page && w.yMin >= marker.yMin - 0.1
    && w.yMax < (next?.page === marker.page ? next.yMin : 556));
  // Reconstruct each cell after layout-only line breaks, without losing any
  // original identifier characters or adding default syllabic hyphenation.
  const expected = [row.contraparte, row.folio, row.expediente, row.vencimiento, row.dias, row.bucket];
  bounds.forEach(([left, right], col) => {
    const cell = body.filter(w => w.xMin >= left - 0.1 && w.xMin < right);
    expect(cell.length, `column ${col}`).toBeGreaterThan(0);
    for (const word of cell) expect(word.xMax, JSON.stringify(word)).toBeLessThanOrEqual(right + 0.1);
    if (col < expected.length) expect(compact(cell.map(w => w.text).join(""))).toBe(compact(expected[col]));
  });
}

describe("Cartera PDF: nombres e identificadores sin recorte horizontal", () => {
  it("conserva el sufijo mock P01 y el expediente completo dentro de sus celdas", async () => {
    const name = "cartera-celdas-mock";
    const rows = [fixture, { ...fixture, folio: "FP-000046", expediente: "ELNAC00033" }];
    const pdf = await inspectPdf(name, document(rows));
    expect(pdf.text).toContain(LEYENDA_VALUACION_EUR);
    rows.forEach((row, index) => assertRow(name, row, index, rows));
  });

  it("envuelve tokens anchos y números grandes sin invadir columnas contiguas", async () => {
    const name = "cartera-celdas-tokens";
    const rows = [{ ...fixture, contraparte: "W".repeat(80), expediente: "EXP-" + "W".repeat(40),
      saldo: "1234567.89", mxnHistorico: "1234567.89", mxnCorte: "1234000.00", diferencia: "-567.89" }];
    const pdf = await inspectPdf(name, document(rows));
    assertRow(name, rows[0], 0, rows);
    for (const value of ["1,234,567.89", "1,234,000.00", "-567.89"]) expect(pdf.text).toContain(value);
    expect(pdf.pages).toBe(1);
  });

  it("mantiene las columnas y cada folio una vez durante los saltos de página", async () => {
    const name = "cartera-celdas-multipagina";
    const rows = Array.from({ length: 51 }, (_, i) => ({ ...fixture, folio: `QA-${String(i + 1).padStart(3, "0")}` }));
    const before = JSON.stringify(rows);
    const pdf = await inspectPdf(name, document(rows));
    expect(pdf.pages).toBeGreaterThan(2);
    expect(JSON.stringify(rows)).toBe(before);
    const words = pdfWordBounds(name);
    rows.forEach((row, index) => {
      expect(words.filter(w => w.text === row.folio)).toHaveLength(1);
      assertRow(name, row, index, rows);
    });
    expect(words.filter(w => w.yMin < 570).every(w => w.yMax <= 556)).toBe(true);
    expect(pdf.text).toContain(`Página ${pdf.pages} de ${pdf.pages}`);
  });
});
