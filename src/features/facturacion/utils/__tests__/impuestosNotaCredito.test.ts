/**
 * P1-IVA — El cálculo interno de la NC usa la misma regla que el payload SAT.
 */
import { describe, it, expect } from "vitest";
import {
  impuestosLineaNC,
  tasaTrasladoNC,
  tratamientoLineaNC,
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

  it("gravado 8% sin tasa guardada cae a 0.08 (no a 0.16)", () => {
    expect(tasaTrasladoNC({ tipo_iva: "gravado_8" })).toBe(0.08);
  });

  it("tasa 0% no aporta IVA pero sí traslada", () => {
    const r = impuestosLineaNC(linea({ tipo_iva: "tasa_0", tasa_iva: 0 }));
    expect(r.iva).toBe(0);
    expect(r.total).toBe(1000);
  });

  it("exento no aporta IVA aunque venga con tasa 16 guardada", () => {
    const r = impuestosLineaNC(linea({ tipo_iva: "exento", tasa_iva: 0.16 }));
    expect(r.iva).toBe(0);
    expect(r.total).toBe(1000);
  });

  it("no objeto (SAT 01) no aporta IVA", () => {
    const r = impuestosLineaNC(linea({ tipo_iva: "no_objeto", tasa_iva: null }));
    expect(r.iva).toBe(0);
    expect(r.total).toBe(1000);
  });

  it("reversa las retenciones ISR e IVA del renglón original", () => {
    const r = impuestosLineaNC(
      linea({ tipo_iva: "gravado_16", tasa_iva: 0.16, tasa_ret_isr: 0.1, tasa_ret_iva: 0.04 }),
    );
    expect(r.retIsr).toBe(100);
    expect(r.retIva).toBe(40);
    expect(r.total).toBe(1020);
    expect(factorTotalNC(linea({ tipo_iva: "gravado_16", tasa_iva: 0.16, tasa_ret_isr: 0.1, tasa_ret_iva: 0.04 }))).toBeCloseTo(1.02, 6);
  });

  it("un renglón sin tipo ni tasa es indeterminado y no se supone 16%", () => {
    expect(tratamientoLineaNC({})).toBeNull();
    expect(lineaIndeterminadaNC({})).toBe(true);
    expect(claveTratamientoNC({})).toBe("indeterminado");
    expect(etiquetaTratamientoNC({})).toMatch(/por definir/);
  });

  it("un renglón legacy con tasa explícita se trata como gravado, nunca exento", () => {
    expect(tratamientoLineaNC({ tasa_iva: 0.16 })).toBe("gravado_16");
    expect(tratamientoLineaNC({ tasa_iva: 0 })).toBe("tasa_0");
  });

  it("dos renglones con el mismo tratamiento comparten clave", () => {
    const a = claveTratamientoNC({ tipo_iva: "gravado_16", tasa_iva: 0.16 });
    const b = claveTratamientoNC({ tipo_iva: "gravado_16", tasa_iva: 0.16 });
    const c = claveTratamientoNC({ tipo_iva: "exento" });
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});
