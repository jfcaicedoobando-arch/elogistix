import { describe, it, expect } from "vitest";
import { matchConceptoVenta, normalizeConceptoNombre } from "../matchConceptoVenta";

interface Concepto {
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
}

function concepto(descripcion: string): Concepto {
  return { descripcion, cantidad: 1, precio_unitario: 100 };
}

describe("normalizeConceptoNombre", () => {
  it("normaliza null/undefined a cadena vacía", () => {
    expect(normalizeConceptoNombre(null)).toBe("");
    expect(normalizeConceptoNombre(undefined)).toBe("");
  });
});

describe("matchConceptoVenta", () => {
  it("match exacto con distinto case/espacios", () => {
    const conceptos = [concepto("  Flete Maritimo  "), concepto("Maniobras")];
    expect(matchConceptoVenta(conceptos, "flete maritimo")?.descripcion).toBe("  Flete Maritimo  ");
  });

  it("A-5: sin match NO empareja por posición", () => {
    const conceptos = [concepto("A"), concepto("B")];
    expect(matchConceptoVenta(conceptos, "no-existe")).toBeUndefined();
    expect(matchConceptoVenta(conceptos, "otro-que-no-existe")).toBeUndefined();
  });

  it("A-5: conceptos reordenados siguen emparejando por nombre", () => {
    const conceptos = [concepto("Maniobras"), concepto("Flete")];
    expect(matchConceptoVenta(conceptos, "Flete")?.descripcion).toBe("Flete");
    expect(matchConceptoVenta(conceptos, "Maniobras")?.descripcion).toBe("Maniobras");
  });

  it("A-5: nombre renombrado queda sin emparejar (no toma el vecino)", () => {
    const conceptos = [concepto("Flete marítimo consolidado"), concepto("Maniobras")];
    expect(matchConceptoVenta(conceptos, "Flete")).toBeUndefined();
  });

  it("concepto vacío no empareja", () => {
    expect(matchConceptoVenta([concepto("")], "   ")).toBeUndefined();
  });
});
