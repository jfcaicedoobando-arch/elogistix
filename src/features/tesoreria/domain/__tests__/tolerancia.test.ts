/**
 * 13.117.0 — Bordes de la tolerancia de matching bancario.
 * Un cambio de `<=` a `<` en `dentroDeTolerancia` rompería la conciliación
 * automática para movimientos con diferencia EXACTAMENTE igual a $1 —
 * caso común con comisiones bancarias redondeadas.
 */
import { describe, it, expect } from "vitest";
import { dentroDeTolerancia, deltaDiasIso, rangoFechasIso } from "../tolerancia";

describe("dentroDeTolerancia (monto)", () => {
  it("diferencia EXACTA = tolerancia → true (inclusivo)", () => {
    expect(dentroDeTolerancia(100, 101, 1)).toBe(true);
    expect(dentroDeTolerancia(100, 99, 1)).toBe(true);
  });

  it("diferencia 1 centavo por encima → false", () => {
    expect(dentroDeTolerancia(100, 101.01, 1)).toBe(false);
  });

  it("misma cantidad → true (delta=0)", () => {
    expect(dentroDeTolerancia(100, 100)).toBe(true);
  });

  it("orden de argumentos no importa (simétrico)", () => {
    expect(dentroDeTolerancia(50, 100, 1)).toBe(dentroDeTolerancia(100, 50, 1));
  });

  it("NaN/Infinity → false (datos sucios no matchean)", () => {
    expect(dentroDeTolerancia(NaN, 100)).toBe(false);
    expect(dentroDeTolerancia(100, Infinity)).toBe(false);
  });

  it("tolerancia custom funciona (caso ±$0.01 para conciliación estricta)", () => {
    expect(dentroDeTolerancia(100, 100.01, 0.01)).toBe(true);
    expect(dentroDeTolerancia(100, 100.02, 0.01)).toBe(false);
  });
});

describe("deltaDiasIso", () => {
  it("misma fecha → 0", () => {
    expect(deltaDiasIso("2026-06-15", "2026-06-15")).toBe(0);
  });

  it("1 día de diferencia (orden no importa)", () => {
    expect(deltaDiasIso("2026-06-15", "2026-06-16")).toBe(1);
    expect(deltaDiasIso("2026-06-16", "2026-06-15")).toBe(1);
  });

  it("cruzando cambio de mes", () => {
    expect(deltaDiasIso("2026-01-31", "2026-02-02")).toBe(2);
  });

  it("cruzando año bisiesto (29 feb)", () => {
    expect(deltaDiasIso("2024-02-28", "2024-03-01")).toBe(2);
  });

  it("fecha inválida → Infinity (no matchea por accidente)", () => {
    expect(deltaDiasIso("not-a-date", "2026-06-15")).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("rangoFechasIso", () => {
  it("±5 días por default centrado en la fecha", () => {
    const r = rangoFechasIso("2026-06-15");
    expect(r.desde).toBe("2026-06-10");
    expect(r.hasta).toBe("2026-06-20");
  });

  it("cruza inicio de mes correctamente", () => {
    const r = rangoFechasIso("2026-03-02", 5);
    expect(r.desde).toBe("2026-02-25");
    expect(r.hasta).toBe("2026-03-07");
  });

  it("tolerancia 0 → mismo día desde y hasta", () => {
    const r = rangoFechasIso("2026-06-15", 0);
    expect(r.desde).toBe("2026-06-15");
    expect(r.hasta).toBe("2026-06-15");
  });
});
