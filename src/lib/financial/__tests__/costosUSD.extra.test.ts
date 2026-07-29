import { describe, it, expect } from "vitest";
import {
  detectarFilasMixtas,
  sumarEnMoneda,
  sumarEnUSD,
  aUSD,
  type FilaMixta,
  type SumaMonedaResult,
} from "@/lib/financial/costosUSD";

const TC_USD = 17;
const TC_EUR = 19;

describe("costosUSD.extra — detectarFilasMixtas", () => {
  it("lista homogénea USD → sin mixtas", () => {
    const result: FilaMixta[] = detectarFilasMixtas(
      [{ moneda: "USD" }, { moneda: "USD" }],
      "USD",
    );
    expect(result).toHaveLength(0);
  });

  it("detecta fila MXN en target USD", () => {
    const result = detectarFilasMixtas([{ moneda: "MXN" }, { moneda: "USD" }], "USD");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ index: 0, moneda: "MXN" });
  });

  it("detecta múltiples filas mixtas", () => {
    const items = [{ moneda: "EUR" }, { moneda: "USD" }, { moneda: "MXN" }];
    const result = detectarFilasMixtas(items, "USD");
    expect(result).toHaveLength(2);
  });

  it("lista vacía → sin mixtas", () => {
    expect(detectarFilasMixtas([], "MXN")).toHaveLength(0);
  });
});

describe("costosUSD.extra — sumarEnMoneda hacia USD", () => {
  it("suma homogénea USD sin conversión", () => {
    const r: SumaMonedaResult = sumarEnMoneda(
      [{ monto: 100, moneda: "USD" }, { monto: 200, moneda: "USD" }],
      "USD", TC_USD, TC_EUR,
    );
    expect(r.total).toBe(300);
    expect(r.homogenea).toBe(true);
  });

  it("convierte MXN a USD correctamente", () => {
    const r = sumarEnMoneda([{ monto: 1700, moneda: "MXN" }], "USD", 17, TC_EUR);
    expect(r.total).toBeCloseTo(100, 2);
    expect(r.homogenea).toBe(false);
  });

  it("lanza si TC inválido con filas mixtas", () => {
    expect(() =>
      sumarEnMoneda([{ monto: 100, moneda: "MXN" }], "USD", 0, TC_EUR),
    ).toThrow();
  });
});

describe("costosUSD.extra — sumarEnMoneda hacia MXN", () => {
  it("suma homogénea MXN", () => {
    const r = sumarEnMoneda(
      [{ monto: 500, moneda: "MXN" }, { monto: 300, moneda: "MXN" }],
      "MXN", TC_USD, TC_EUR,
    );
    expect(r.total).toBe(800);
    expect(r.homogenea).toBe(true);
  });

  it("convierte USD a MXN con TC", () => {
    const r = sumarEnMoneda([{ monto: 100, moneda: "USD" }], "MXN", 17, TC_EUR);
    expect(r.total).toBeCloseTo(1700, 2);
  });
});

describe("costosUSD.extra — sumarEnUSD", () => {
  it("suma USD directamente", () => {
    expect(sumarEnUSD([{ monto: 50, moneda: "USD" }, { monto: 100, moneda: "USD" }], TC_USD, TC_EUR)).toBe(150);
  });

  it("con TC inválido usa 1 como fallback (wrapper laxo)", () => {
    const result = sumarEnUSD([{ monto: 100, moneda: "USD" }], 0, TC_EUR);
    expect(result).toBe(100);
  });

  it("lista vacía → 0", () => {
    expect(sumarEnUSD([], TC_USD, TC_EUR)).toBe(0);
  });
});

describe("costosUSD.extra — aUSD", () => {
  it("USD se devuelve sin conversión", () => {
    expect(aUSD(200, "USD", TC_USD, TC_EUR)).toBe(200);
  });

  it("MXN a USD con TC correcto", () => {
    expect(aUSD(1700, "MXN", 17, TC_EUR)).toBeCloseTo(100, 2);
  });

  it("lanza si TC USD es 0 y moneda no es USD", () => {
    expect(() => aUSD(1700, "MXN", 0, TC_EUR)).toThrow();
  });

  it("lanza si TC USD es NaN", () => {
    expect(() => aUSD(100, "MXN", NaN, TC_EUR)).toThrow();
  });

  it("lanza si moneda EUR y TC EUR inválido", () => {
    expect(() => aUSD(100, "EUR", 17, 0)).toThrow();
  });
});

describe("costosUSD — canon C6 (TC no confiable)", () => {
  it("lanza si el TC de USD es 1 al convertir MXN → USD", () => {
    expect(() => sumarEnMoneda([{ monto: 100, moneda: "MXN" }], "USD", 1, TC_EUR)).toThrow(
      /tipo de cambio confiable/,
    );
  });

  it("lanza si el TC de EUR no es confiable con filas EUR hacia MXN", () => {
    expect(() => sumarEnMoneda([{ monto: 100, moneda: "EUR" }], "MXN", TC_USD, 1)).toThrow();
  });

  it("no lanza cuando todas las filas ya están en el target", () => {
    expect(sumarEnMoneda([{ monto: 100, moneda: "USD" }], "USD", 1, 1).total).toBe(100);
  });
});
