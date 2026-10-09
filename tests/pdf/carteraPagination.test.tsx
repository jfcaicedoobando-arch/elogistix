import { describe, expect, it } from "vitest";
import { ReporteCarteraDocument, type FilaFacturaPdf, type FilaTotalPdf } from "@/pdf/documents/ReporteCarteraDocument";
import { inspectPdf } from "./inspectPdf";
import { pdfWordBounds } from "./inspectPdfLayout";

const fila: FilaFacturaPdf = {
  contraparte: "Proveedor sintético", folio: "FP-000008", expediente: "EXP-008", vencimiento: "12/10/2026",
  dias: "0", bucket: "Vigente", moneda: "USD", saldo: "95.00",
  mxnHistorico: "1900.00", mxnCorte: "1720.72", diferencia: "-179.28",
};
function totales(titulo: string, saldo: boolean): FilaTotalPdf[] {
  return ["Vigente", "1-30 días", "31-60 días", "61-90 días", "+90 días", `Total ${titulo}`].map((etiqueta, i) => ({
    etiqueta, conteo: saldo && (i === 0 || i === 5) ? "1" : "0",
    mxnHistorico: saldo && (i === 0 || i === 5) ? "1900.00" : "0.00",
    mxnCorte: saldo && (i === 0 || i === 5) ? "1720.72" : "0.00",
    diferencia: saldo && (i === 0 || i === 5) ? "-179.28" : "0.00",
  }));
}
function documento(facturas: FilaFacturaPdf[], nombre = "Organización sintética") {
  return <ReporteCarteraDocument fechaCorte="2026-10-09" leyendaTc="TC DOF USD/MXN 18.1128 (publicado el día del corte)"
    busqueda="FP-000008" emisor={{ organizacionNombre: nombre }} bloques={[
      { titulo: "Cuentas por cobrar", totales: totales("Cuentas por cobrar", false), facturas: [] },
      { titulo: "Cuentas por pagar", totales: totales("Cuentas por pagar", true), facturas },
    ]} />;
}

describe("Cartera: resumen indivisible y detalle multipágina (extensión 13)", () => {
  it("mueve título, encabezado completo y seis filas CxP juntos, sin recorte al pie", async () => {
    const name = "audit13-cartera-salto-resumen";
    const pdf = await inspectPdf(name, documento([fila]));
    expect(pdf.pages).toBe(2);
    const words = pdfWordBounds(name);
    // The old template painted a partial CxP header at the bottom of page one.
    const primera = words.filter((w) => w.page === 0).map((w) => w.text).join(" ");
    expect(primera).not.toContain("Cuentas por pagar");
    const segunda = words.filter((w) => w.page === 1);
    expect(segunda.filter((w) => w.text === "Antigüedad")).toHaveLength(2); // section + column
    expect(segunda.find((w) => w.text === "Vigente")?.yMax).toBeLessThan(150);
    for (const text of ["FP-000008", "USD 95.00", "MXN 1,900.00", "MXN 1,720.72", "MXN -179.28", "Filtro de búsqueda: FP-000008"]) {
      expect(pdf.text).toContain(text);
    }
    expect(pdf.text).not.toContain("Documento interno");
    expect(pdf.text).not.toContain("Documento generado electrónicamente");
    expect(words.filter((w) => w.yMin < 570).every((w) => w.yMax <= 556)).toBe(true);
  });

  it("conserva cada factura larga una sola vez y encabezados completos en continuaciones", async () => {
    const name = "audit13-cartera-detalle-largo";
    const filas = Array.from({ length: 40 }, (_, i) => ({ ...fila, folio: `QA-${String(i + 1).padStart(3, "0")}`,
      contraparte: `Proveedor de servicios logísticos internacionales con nombre extenso ${i + 1}` }));
    const pdf = await inspectPdf(name, documento(filas, "Organización sintética de servicios logísticos internacionales de México y Latinoamérica"));
    expect(pdf.pages).toBeGreaterThan(2);
    const words = pdfWordBounds(name);
    for (const row of filas) expect(words.filter((w) => w.text === row.folio)).toHaveLength(1);
    for (let page = 2; page < pdf.pages; page += 1) {
      const pagina = words.filter((w) => w.page === page);
      for (const label of ["Folio", "histórico", "corte", "cambiaria"]) {
        expect(pagina.find((w) => w.text === label)?.yMax).toBeLessThan(85);
      }
      expect(pagina.some((w) => w.text.startsWith("QA-"))).toBe(true);
    }
    expect(words.filter((w) => w.yMin < 570).every((w) => w.yMax <= 556)).toBe(true);
    expect(pdf.text).toContain(`Página ${pdf.pages} de ${pdf.pages}`);
  });
});
