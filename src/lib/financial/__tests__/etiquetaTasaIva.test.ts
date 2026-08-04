/** R7-FIX2 — la etiqueta de IVA debe salir de las filas, no de la org. */
import { describe, it, expect } from "vitest";
import { etiquetaTasaIva, tasasEfectivas } from "@/lib/financial/etiquetaTasaIva";

describe("etiquetaTasaIva (R7-FIX2)", () => {
  it("usa la tasa de la fila cuando es única (frontera 8%)", () => {
    expect(etiquetaTasaIva([{ aplica_iva: true, tasa_iva_aplicada: 0.08 }], 0.16)).toBe("8%");
  });

  it("marca tasas mixtas cuando coexisten 8% y 16%", () => {
    expect(
      etiquetaTasaIva(
        [
          { aplica_iva: true, tasa_iva_aplicada: 0.16 },
          { aplica_iva: true, tasa_iva_aplicada: 0.08 },
        ],
        0.16,
      ),
    ).toBe("tasas mixtas 8/16%");
  });

  it("cae en la tasa de la organización si ninguna fila causa IVA", () => {
    expect(etiquetaTasaIva([{ aplica_iva: false, tasa_iva_aplicada: 0 }], 0.16)).toBe("16%");
    expect(etiquetaTasaIva([], 0.08)).toBe("8%");
  });

  it("deriva la tasa del flag cuando no viene tasa explícita", () => {
    expect(tasasEfectivas([{ aplica_iva: true }], 0.16)).toEqual([16]);
  });
});
