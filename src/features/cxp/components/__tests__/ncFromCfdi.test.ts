import { describe, it, expect } from "vitest";
import { buildNcPrefillFromCfdi } from "../ncFromCfdi";
import type { CfdiParsedResponse } from "@/features/cxp/services";

function makeCfdiResponse(overrides: Partial<CfdiParsedResponse["cfdi"]> = {}): CfdiParsedResponse {
  return {
    cfdi: {
      uuid: "123e4567-e89b-12d3-a456-426614174000",
      serie: "NC",
      folio: "42",
      fecha: "2026-03-15",
      moneda: "MXN",
      tipo_cambio: 1,
      subtotal: 1000,
      total: 1160,
      iva_trasladado: 160,
      ieps_trasladado: 0,
      retenciones: 0,
      tipo_comprobante: "E",
      emisor: { rfc: "AAA010101AAA", nombre: "Emisor", regimen: "601" },
      receptor: { rfc: "BBB020202BBB", nombre: "Receptor" },
      conceptos: [{ descripcion: "Descuento", importe: 1000, iva: 160, ieps: 0 }],
      ...overrides,
    },
    ai: null,
    file: { xml: "path/to/xml.xml", pdf: null, pdfName: null },
  };
}

describe("buildNcPrefillFromCfdi", () => {
  it("arma el folio combinando serie y folio", () => {
    const r = buildNcPrefillFromCfdi(makeCfdiResponse());
    expect(r.folio).toBe("NC-42");
  });

  it("usa un prefijo del UUID cuando no hay serie/folio", () => {
    const r = buildNcPrefillFromCfdi(makeCfdiResponse({ serie: "", folio: "" }));
    expect(r.folio).toBe("123e4567");
  });

  it("prefill monto con dos decimales", () => {
    const r = buildNcPrefillFromCfdi(makeCfdiResponse({ total: 1234.5 }));
    expect(r.monto).toBe("1234.50");
  });

  it("copia el UUID fiscal", () => {
    const r = buildNcPrefillFromCfdi(makeCfdiResponse());
    expect(r.uuidFiscal).toBe("123e4567-e89b-12d3-a456-426614174000");
  });

  it("usa la descripción del primer concepto si no hay notas de IA", () => {
    const r = buildNcPrefillFromCfdi(makeCfdiResponse());
    expect(r.descripcion).toBe("Descuento");
  });

  it("prioriza notas de IA sobre el concepto", () => {
    const response = makeCfdiResponse();
    response.ai = { notas: "Nota de crédito por descuento comercial" };
    const r = buildNcPrefillFromCfdi(response);
    expect(r.descripcion).toBe("Nota de crédito por descuento comercial");
  });
});
