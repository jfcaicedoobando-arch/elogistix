/**
 * v13.360.0 — Documento del buzón = PDF + XML del mismo CFDI.
 */
import { describe, it, expect } from "vitest";
import {
  chipsArchivosEntrante,
  emparejarArchivosEntrantes,
  faltaXmlFiscal,
  tipoArchivoEntrante,
  validarParejaEntrante,
} from "@/lib/domain/facturasEntrantes";

describe("tipoArchivoEntrante", () => {
  it("clasifica por extensión y MIME", () => {
    expect(tipoArchivoEntrante({ name: "f.PDF" })).toBe("pdf");
    expect(tipoArchivoEntrante({ name: "cfdi.xml" })).toBe("xml");
    expect(tipoArchivoEntrante({ name: "sin", type: "application/pdf" })).toBe("pdf");
    expect(tipoArchivoEntrante({ name: "foto.png" })).toBeNull();
  });
});

describe("emparejarArchivosEntrantes", () => {
  it("acomoda PDF y XML en sus ranuras e ignora el resto", () => {
    const r = emparejarArchivosEntrantes([
      { name: "a.pdf" }, { name: "b.xml" }, { name: "c.pdf" }, { name: "d.png" },
    ]);
    expect(r.pdf?.name).toBe("a.pdf");
    expect(r.xml?.name).toBe("b.xml");
    expect(r.ignorados.map((f) => f.name)).toEqual(["c.pdf", "d.png"]);
  });

  it("conserva lo previo cuando la ranura ya está ocupada", () => {
    const r = emparejarArchivosEntrantes([{ name: "nuevo.pdf" }], { pdf: { name: "viejo.pdf" }, xml: null });
    expect(r.pdf?.name).toBe("viejo.pdf");
  });
});

describe("validarParejaEntrante", () => {
  it("exige al menos un archivo", () => {
    expect(validarParejaEntrante({ pdf: null, xml: null })).toMatch(/Adjunta el PDF/);
  });

  it("acepta sólo PDF y valida tamaño", () => {
    expect(validarParejaEntrante({ pdf: { name: "a.pdf", size: 1000 }, xml: null })).toBeNull();
    expect(
      validarParejaEntrante({ pdf: { name: "a.pdf", size: 99 * 1024 * 1024 }, xml: null }),
    ).toMatch(/supera el límite/);
  });
});

describe("faltaXmlFiscal", () => {
  it("sólo marca falta para proveedores nacionales", () => {
    expect(faltaXmlFiscal({ esNacional: true, tieneXml: false })).toBe(true);
    expect(faltaXmlFiscal({ esNacional: true, tieneXml: true })).toBe(false);
    expect(faltaXmlFiscal({ esNacional: false, tieneXml: false })).toBe(false);
  });
});

describe("chipsArchivosEntrante", () => {
  it("detecta PDF + XML y el caso legado de sólo XML", () => {
    expect(chipsArchivosEntrante({ archivo_path: "o/e/a.pdf", xml_path: "o/e/a.xml" })).toEqual(["pdf", "xml"]);
    expect(chipsArchivosEntrante({ archivo_path: "o/e/a.pdf", xml_path: null })).toEqual(["pdf"]);
    expect(chipsArchivosEntrante({ archivo_path: "o/e/a.xml", xml_path: null })).toEqual(["xml"]);
  });
});
