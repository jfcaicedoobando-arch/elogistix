import { describe, expect, it } from "vitest";
import { comoBlobPdf, esRutaPdf, MIME_PDF } from "@/lib/pdf/blobPdfUrl";

describe("blobPdfUrl", () => {
  it("reetiqueta un blob sin tipo como application/pdf", () => {
    const blob = new Blob(["x"], { type: "application/octet-stream" });
    expect(comoBlobPdf(blob).type).toBe(MIME_PDF);
  });

  it("conserva el blob cuando ya es pdf", () => {
    const blob = new Blob(["x"], { type: MIME_PDF });
    expect(comoBlobPdf(blob)).toBe(blob);
  });

  it("detecta rutas pdf y descarta otras", () => {
    expect(esRutaPdf("org/factura.PDF")).toBe(true);
    expect(esRutaPdf("org/factura.xml")).toBe(false);
    expect(esRutaPdf(null)).toBe(false);
  });
});
