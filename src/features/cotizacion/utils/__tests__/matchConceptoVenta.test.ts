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
  it("match exacto con distinto case/espacios NO consume posición del fallback", () => {
    const conceptos = [concepto("  Flete Maritimo  "), concepto("Maniobras")];
    const fallback = { idx: 0 };
    const r = matchConceptoVenta(conceptos, "flete maritimo", fallback);
    expect(r?.descripcion).toBe("  Flete Maritimo  ");
    expect(fallback.idx).toBe(0);
  });

  it("sin match usa el fallback posicional y avanza el índice", () => {
    const conceptos = [concepto("A"), concepto("B")];
    const fallback = { idx: 0 };
    const r = matchConceptoVenta(conceptos, "no-existe", fallback);
    expect(r?.descripcion).toBe("A");
    expect(fallback.idx).toBe(1);
  });

  it("dos costos seguidos sin match consumen posiciones consecutivas", () => {
    const conceptos = [concepto("A"), concepto("B")];
    const fallback = { idx: 0 };
    const r1 = matchConceptoVenta(conceptos, "x1", fallback);
    const r2 = matchConceptoVenta(conceptos, "x2", fallback);
    expect(r1?.descripcion).toBe("A");
    expect(r2?.descripcion).toBe("B");
    expect(fallback.idx).toBe(2);
  });

  it("un match por nombre entre dos sin-match no consume posición", () => {
    const conceptos = [concepto("A"), concepto("B"), concepto("Flete")];
    const fallback = { idx: 0 };
    const r1 = matchConceptoVenta(conceptos, "no-existe-1", fallback); // -> A (idx 0), fallback.idx=1
    const r2 = matchConceptoVenta(conceptos, "flete", fallback); // match por nombre, no consume
    const r3 = matchConceptoVenta(conceptos, "no-existe-2", fallback); // -> B (idx 1), fallback.idx=2
    expect(r1?.descripcion).toBe("A");
    expect(r2?.descripcion).toBe("Flete");
    expect(r3?.descripcion).toBe("B");
    expect(fallback.idx).toBe(2);
  });
});
