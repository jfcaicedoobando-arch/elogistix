import { describe, it, expect } from "vitest";
import { sumarEnUSD, aUSD, sumarEnMoneda, detectarFilasMixtas } from "@/lib/financial/costosUSD";

describe("aUSD", () => {
  it("retorna el mismo monto si ya es USD", () => {
    expect(aUSD(100, "USD", 17.5, 19.0)).toBe(100);
  });
  it("convierte MXN a USD", () => {
    expect(aUSD(1750, "MXN", 17.5, 19.0)).toBeCloseTo(100);
  });
  it("convierte EUR a USD (vía MXN)", () => {
    expect(aUSD(100, "EUR", 17.5, 19.0)).toBeCloseTo((100 * 19) / 17.5);
  });
});

describe("sumarEnUSD", () => {
  it("retorna 0 con lista vacía", () => {
    expect(sumarEnUSD([], 17.5, 19)).toBe(0);
  });
  it("suma montos mixtos sin errores de punto flotante", () => {
    const total = sumarEnUSD(
      [
        { monto: 100, moneda: "USD" },
        { monto: 1750, moneda: "MXN" },
        { monto: 100, moneda: "EUR" },
      ],
      17.5,
      19,
    );
    expect(total).toBeCloseTo(100 + 100 + (100 * 19) / 17.5, 2);
  });
  it("acumula valores pequeños sin perder precisión (0.1 * 3)", () => {
    const total = sumarEnUSD(
      [
        { monto: 0.1, moneda: "USD" },
        { monto: 0.1, moneda: "USD" },
        { monto: 0.1, moneda: "USD" },
      ],
      17.5,
      19,
    );
    expect(total).toBe(0.3);
  });
});

describe("detectarFilasMixtas", () => {
  it("retorna vacío cuando todas coinciden con el target", () => {
    expect(
      detectarFilasMixtas(
        [{ moneda: "USD" }, { moneda: "USD" }],
        "USD",
      ),
    ).toEqual([]);
  });
  it("identifica índices de filas distintas al target", () => {
    expect(
      detectarFilasMixtas(
        [{ moneda: "USD" }, { moneda: "MXN" }, { moneda: "EUR" }, { moneda: "USD" }],
        "USD",
      ),
    ).toEqual([
      { index: 1, moneda: "MXN" },
      { index: 2, moneda: "EUR" },
    ]);
  });
});

describe("sumarEnMoneda", () => {
  it("marca homogenea cuando todas las filas coinciden con target", () => {
    const r = sumarEnMoneda(
      [
        { monto: 50, moneda: "USD" },
        { monto: 50, moneda: "USD" },
      ],
      "USD",
      17.5,
      19,
    );
    expect(r.homogenea).toBe(true);
    expect(r.filasMixtas).toEqual([]);
    expect(r.total).toBe(100);
  });

  it("convierte filas mixtas a USD y reporta índices", () => {
    const r = sumarEnMoneda(
      [
        { monto: 100, moneda: "USD" },
        { monto: 1750, moneda: "MXN" },
      ],
      "USD",
      17.5,
      19,
    );
    expect(r.homogenea).toBe(false);
    expect(r.filasMixtas).toEqual([{ index: 1, moneda: "MXN" }]);
    expect(r.total).toBeCloseTo(200, 2);
  });

  it("convierte target MXN: USD → MXN vía tcUSD", () => {
    const r = sumarEnMoneda(
      [
        { monto: 1000, moneda: "MXN" },
        { monto: 100, moneda: "USD" },
      ],
      "MXN",
      17.5,
      19,
    );
    expect(r.homogenea).toBe(false);
    expect(r.total).toBeCloseTo(1000 + 100 * 17.5, 2);
  });

  it("lanza si tcUSD = 0 y hay filas mixtas", () => {
    expect(() =>
      sumarEnMoneda(
        [
          { monto: 100, moneda: "USD" },
          { monto: 1750, moneda: "MXN" },
        ],
        "USD",
        0,
        19,
      ),
    ).toThrow(/TC requerido/);
  });

  it("no lanza si tcUSD = 0 pero todas las filas son del target", () => {
    const r = sumarEnMoneda(
      [
        { monto: 100, moneda: "USD" },
        { monto: 50, moneda: "USD" },
      ],
      "USD",
      0,
      19,
    );
    expect(r.total).toBe(150);
  });

  it("lanza si tcEUR = 0 y hay filas EUR", () => {
    expect(() =>
      sumarEnMoneda(
        [
          { monto: 100, moneda: "USD" },
          { monto: 100, moneda: "EUR" },
        ],
        "USD",
        17.5,
        0,
      ),
    ).toThrow(/tipoCambioEUR/);
  });
});
