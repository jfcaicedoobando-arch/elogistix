import { describe, expect, it } from "vitest";
import { detalleConceptosEnFactura, esEstadoEnFactura, estadoFacturaConcepto, type FacturaConcepto } from "../estadoConceptoFactura";

const concepto = { proforma_id: "p1", moneda: "MXN" };
const factura: FacturaConcepto = { id: "f1", proforma_id: "p1", moneda: "MXN", estado: "Borrador" };

describe("estado visual del concepto por factura vinculada", () => {
  it.each(["factura_id", "factura_secundaria_id"])("%s no supera una FK inversa explícitamente contradictoria", enlace => {
    const proforma = { id: "p1", [enlace]: "f1" };
    expect(estadoFacturaConcepto(concepto, [{ ...factura, estado: "Emitida", proforma_id: "p2" }], [proforma])).toBe("en_factura");
  });

  it.each(["factura_id", "factura_secundaria_id"])("%s conserva la emisión válida de una fusión con FK inversa nula", enlace => {
    const proforma = { id: "p1", [enlace]: "f1" };
    expect(estadoFacturaConcepto(concepto, [{ ...factura, estado: "Emitida", proforma_id: null }], [proforma])).toBe("facturado");
  });

  it("una candidata emitida válida no oculta otra referencia contradictoria", () => {
    expect(estadoFacturaConcepto(concepto, [
      { ...factura, estado: "Emitida", proforma_id: "p2" },
      { ...factura, id: "f2", estado: "Emitida" },
    ], [{ id: "p1", factura_id: "f1", factura_secundaria_id: "f2" }])).toBe("en_factura");
  });

  it("conflictos borrados o de otra moneda no alteran el vínculo actual", () => {
    for (const over of [{ deleted_at: "2026-10-11" }, { moneda: "USD" }]) {
      expect(estadoFacturaConcepto(concepto, [
        { ...factura, estado: "Emitida" },
        { ...factura, id: "f2", estado: "Emitida", proforma_id: "p2", ...over },
      ], [{ id: "p1", factura_id: "f1", factura_secundaria_id: "f2" }])).toBe("facturado");
    }
  });

  it("resuelve los ids de factura primaria y secundaria sin factura.proforma_id", () => {
    expect(estadoFacturaConcepto(concepto, [{ ...factura, proforma_id: null }], [{ id: "p1", factura_id: "f1" }])).toBe("en_borrador");
    expect(estadoFacturaConcepto(concepto, [{ ...factura, proforma_id: null }], [{ id: "p1", factura_secundaria_id: "f1" }])).toBe("en_borrador");
  });

  it("no atribuye otra moneda, otra proforma ni una factura borrada", () => {
    for (const over of [{ moneda: "USD" }, { proforma_id: "p2" }, { deleted_at: "2026-10-11" }]) {
      expect(estadoFacturaConcepto(concepto, [{ ...factura, ...over }], [])).toBe("en_factura");
    }
  });

  it("proforma cancelada prevalece sobre su conversión histórica", () => {
    expect(estadoFacturaConcepto(concepto, [{ ...factura, estado: "Emitida" }], [
      { id: "p1", estado_proforma: "cancelada", factura_id: "f1" },
    ])).toBe("en_factura");
  });

  it("no infiere emisión para estados desconocidos o vínculos ambiguos", () => {
    expect(estadoFacturaConcepto(concepto, [{ ...factura, estado: "Desconocido" }], [])).toBe("en_factura");
    expect(estadoFacturaConcepto(concepto, [{ ...factura, estado: null }], [])).toBe("en_factura");
    expect(estadoFacturaConcepto(concepto, [factura, { ...factura, id: "f2", estado: "Emitida" }], [])).toBe("en_factura");
  });

  it("una cancelada histórica no oculta el nuevo borrador vinculado", () => {
    expect(estadoFacturaConcepto(concepto, [factura, { ...factura, id: "f0", estado: "Cancelada" }], [])).toBe("en_borrador");
  });

  it("cuenta conceptos en factura sin confundir borradores y documentos emitidos", () => {
    const estados = ["en_borrador", "facturado", "por_timbrar", "pendiente"] as const;
    expect(estados.filter(esEstadoEnFactura)).toHaveLength(3);
    expect(detalleConceptosEnFactura([...estados], true)).toBe("1 emitido · 1 en borrador · 1 por timbrar");
    expect(detalleConceptosEnFactura(["en_borrador", "en_borrador"])).toBe("2 en borrador");
  });
});
