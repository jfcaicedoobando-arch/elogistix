import { describe, it, expect } from "vitest";
import {
  computeReferenciasFallback,
  hasAlgunaReferencia,
  formatearPrefijoReferencias,
} from "@/features/facturacion/hooks/useReferenciasEmbarqueFactura";

describe("useReferenciasEmbarqueFactura helpers", () => {
  it("computeReferenciasFallback usa expediente y referencia_bl de la factura", () => {
    const out = computeReferenciasFallback({ expediente: "E1", referencia_bl: "HL9" });
    expect(out).toEqual({ expediente: "E1", bl_master: null, bl_house: "HL9" });
  });

  it("hasAlgunaReferencia detecta cualquier campo con valor", () => {
    expect(hasAlgunaReferencia(null)).toBe(false);
    expect(hasAlgunaReferencia({ expediente: null, bl_master: null, bl_house: null })).toBe(false);
    expect(hasAlgunaReferencia({ expediente: "E1", bl_master: null, bl_house: null })).toBe(true);
    expect(hasAlgunaReferencia({ expediente: null, bl_master: null, bl_house: "H1" })).toBe(true);
  });

  it("formatearPrefijoReferencias arma prefijo compacto entre corchetes", () => {
    expect(
      formatearPrefijoReferencias({ expediente: "E1", bl_master: "M1", bl_house: "H1" }),
    ).toBe("[Exp. E1 · BL/M: M1 · BL/H: H1] ");
    expect(formatearPrefijoReferencias({ expediente: "E1", bl_master: null, bl_house: null })).toBe("[Exp. E1] ");
    expect(formatearPrefijoReferencias(null)).toBe("");
  });
});
