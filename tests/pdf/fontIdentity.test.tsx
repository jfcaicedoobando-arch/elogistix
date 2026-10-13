import { describe, expect, it } from "vitest";
import { Font, renderToBuffer } from "@react-pdf/renderer";
import { registerPdfFonts } from "../../src/pdf/theme/fonts";
import { FONTS } from "../../src/pdf/theme/tokens";
import { ReporteCarteraDocument } from "../../src/pdf/documents/ReporteCarteraDocument";

// PDFKit caches embedded sources by PostScript name. Distinct font binaries
// sharing that name defeat reuse and can embed a fresh font for every text run.
describe("PDF font source identities", () => {
  it("keeps each bundled Inter face under a distinct PostScript name", async () => {
    registerPdfFonts();
    const descriptors = [
      { fontFamily: FONTS.regular, fontWeight: 400 },
      { fontFamily: FONTS.regular, fontWeight: 600 },
      { fontFamily: FONTS.regular, fontWeight: 400, fontStyle: "italic" },
    ] as const;
    await Promise.all(descriptors.map((descriptor) => Font.load(descriptor)));
    const names = descriptors.map((descriptor) => Font.getFont(descriptor).data?.postscriptName);
    expect(names).toEqual(["Inter-Regular", "Inter-SemiBold", "Inter-Italic"]);
  });

  it("reuses regular and semibold resources across Cartera rows", async () => {
    const rows = Array.from({ length: 40 }, (_, index) => ({
      contraparte: "Proveedor sintético", folio: `QA-${String(index + 1).padStart(5, "0")}`,
      expediente: "EXP00001", vencimiento: "12/10/2026", dias: "1", bucket: "1-30 días",
      moneda: "USD", saldo: "95.00", mxnHistorico: "1900.00", mxnCorte: "1720.72", diferencia: "-179.28",
    }));
    const pdf = await renderToBuffer(<ReporteCarteraDocument fechaCorte="2026-10-12"
      leyendaTc="TC USD/MXN 18.1128" emisor={{ organizacionNombre: "Empresa sintética QA" }}
      bloques={[{ titulo: "Cuentas por pagar", totales: [], facturas: rows }]} />);
    // PDFKit's font dictionaries are not compressed; content streams may be.
    const embeddedFonts = pdf.toString("latin1").match(/\/Subtype \/Type0\b/g) ?? [];
    expect(embeddedFonts).toHaveLength(2);
    expect(pdf.length).toBeLessThan(100_000);
  });
});
