/**
 * P1-IVA — El cálculo interno de la NC usa la misma regla que el payload SAT y
 * NUNCA supone ni corrige el tratamiento fiscal del renglón original.
 */
import { describe, it, expect } from "vitest";
import {
  impuestosLineaNC,
  tasaTrasladoNC,
  tasaCanonicaNC,
  tratamientoLineaNC,
  problemaLineaNC,
  lineaIndeterminadaNC,
  claveTratamientoNC,
  factorTotalNC,
  etiquetaTratamientoNC,
} from "../impuestosNotaCredito";

const linea = (extra: Record<string, unknown> = {}) => ({
  cantidad: 1,
  precio_unitario: 1000,
  ...extra,
});

describe("impuestosNotaCredito", () => {
  it("gravado 16% traslada 160", () => {
    const r = impuestosLineaNC(linea({ tipo_iva: "gravado_16", tasa_iva: 0.16 }));
    expect(r).toMatchObject({ base: 1000, iva: 160, total: 1160 });
  });

  it("gravado 8% de frontera traslada 80", () => {
    const r = impuestosLineaNC(linea({ tipo_iva: "gravado_8", tasa_iva: 0.08 }));
    expect(r.iva).toBe(80);
    expect(r.total).toBe(1080);
  });

  it("gravado 8% sin tasa guardada usa su tasa canónica (no 16%)", () => {
    expect(tasaTrasladoNC({ tipo_iva: "gravado_8" })).toBe(0.08);
    expect(tasaCanonicaNC("gravado_8")).toBe(0.08);
  });

  it("tasa 0% no aporta IVA pero sí traslada", () => {
    const r = impuestosLineaNC(linea({ tipo_iva: "tasa_0", tasa_iva: 0 }));
    expect(r.iva).toBe(0);
    expect(r.total).toBe(1000);
  });

  it("exento y no objeto (SAT 01) no aportan IVA", () => {
    expect(impuestosLineaNC(linea({ tipo_iva: "exento" })).iva).toBe(0);
    expect(impuestosLineaNC(linea({ tipo_iva: "no_objeto", tasa_iva: null })).iva).toBe(0);
  });

  it("reversa las retenciones ISR e IVA del renglón original", () => {
    const base = { tipo_iva: "gravado_16", tasa_iva: 0.16, tasa_ret_isr: 0.1, tasa_ret_iva: 0.04 };
    const r = impuestosLineaNC(linea(base));
    expect(r.retIsr).toBe(100);
    expect(r.retIva).toBe(40);
    expect(r.total).toBe(1020);
    expect(factorTotalNC(linea(base))).toBeCloseTo(1.02, 6);
  });

  it("un renglón sin tipo reconocido es indeterminado, aunque traiga tasa", () => {
    for (const l of [{}, { tasa_iva: 0 }, { tasa_iva: 0.16 }, { tipo_iva: "gravado_11" }]) {
      expect(tratamientoLineaNC(l)).toBeNull();
      expect(lineaIndeterminadaNC(l)).toBe(true);
      expect(claveTratamientoNC(l)).toBe("indeterminado");
      expect(problemaLineaNC(l)).toContain("sin tratamiento fiscal");
    }
    expect(etiquetaTratamientoNC({})).toMatch(/factura original/);
  });

  it("una tasa que contradice el tipo bloquea en vez de elegir una de las dos", () => {
    const mala = { tipo_iva: "gravado_16", tasa_iva: 0.08 };
    expect(problemaLineaNC(mala)).toContain("tasa guardada");
    expect(lineaIndeterminadaNC(mala)).toBe(true);
    expect(lineaIndeterminadaNC({ tipo_iva: "exento", tasa_iva: 0.16 })).toBe(true);
    expect(lineaIndeterminadaNC({ tipo_iva: "tasa_0", tasa_iva: 0.16 })).toBe(true);
    expect(lineaIndeterminadaNC({ tipo_iva: "no_objeto", tasa_iva: 0 })).toBe(false);
  });

  it("la tasa guardada nunca cambia el traslado de un tipo válido", () => {
    expect(tasaTrasladoNC({ tipo_iva: "gravado_16", tasa_iva: 0.08 })).toBe(0.16);
  });

  it("dos renglones con el mismo tratamiento comparten clave", () => {
    const a = claveTratamientoNC({ tipo_iva: "gravado_16", tasa_iva: 0.16 });
    const b = claveTratamientoNC({ tipo_iva: "gravado_16" });
    const c = claveTratamientoNC({ tipo_iva: "exento" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
