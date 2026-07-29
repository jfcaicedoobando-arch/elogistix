import { describe, it, expect } from "vitest";
import { convertirMxn, sumarEnMxn } from "@/lib/financial/convertir";

describe("convertirMxn (canon C6)", () => {
  it("devuelve el mismo monto para MXN", () => {
    expect(convertirMxn(100, "MXN", {})).toEqual({ mxn: 100, tcFaltante: false });
  });

  it("convierte USD con TC válido", () => {
    expect(convertirMxn(10, "usd", { usd: 20 })).toEqual({ mxn: 200, tcFaltante: false });
  });

  it("convierte EUR con TC válido", () => {
    expect(convertirMxn(10, "EUR", { eur: 22 })).toEqual({ mxn: 220, tcFaltante: false });
  });

  it("NO colapsa a TC=1 cuando falta el tipo de cambio", () => {
    expect(convertirMxn(10, "USD", { usd: null })).toEqual({ mxn: null, tcFaltante: true });
    expect(convertirMxn(10, "USD", { usd: 0 })).toEqual({ mxn: null, tcFaltante: true });
    expect(convertirMxn(10, "EUR", {})).toEqual({ mxn: null, tcFaltante: true });
  });

  it("trata montos nulos o inválidos como cero", () => {
    expect(convertirMxn(null, "MXN", {}).mxn).toBe(0);
    expect(convertirMxn(Number.NaN, "MXN", {}).mxn).toBe(0);
  });
});

describe("sumarEnMxn", () => {
  it("suma lo convertible y reporta lo excluido", () => {
    const filas = [
      { monto: 100, moneda: "MXN" },
      { monto: 10, moneda: "USD" },
      { monto: 5, moneda: "EUR" },
    ];
    const res = sumarEnMxn(filas, (f) => ({ monto: f.monto, moneda: f.moneda }), { usd: 20 });
    expect(res.total).toBe(300);
    expect(res.sinTipoCambio).toBe(1);
    expect(res.excluidoPorMoneda).toEqual({ EUR: 5 });
  });

  it("permite TC por fila", () => {
    const filas = [
      { monto: 1, moneda: "USD", tc: { usd: 18 } },
      { monto: 1, moneda: "USD", tc: { usd: 20 } },
    ];
    const res = sumarEnMxn(filas, (f) => ({ monto: f.monto, moneda: f.moneda, tc: f.tc }));
    expect(res.total).toBe(38);
    expect(res.sinTipoCambio).toBe(0);
  });
});

describe("aMxn (canon C6)", () => {
  it("MXN no requiere tipo de cambio", () => {
    expect(aMxn(100, "MXN", null)).toEqual({ monto: 100, tc: 1, fuente: "moneda-local", completo: true });
  });

  it("convierte USD con TC directo", () => {
    const r = aMxn(10, "USD", 20);
    expect(r).toEqual({ monto: 200, tc: 20, fuente: "tc-directo", completo: true });
  });

  it("rechaza TC <= 1 en moneda extranjera (1 USD nunca es 1 MXN)", () => {
    const r = aMxn(10, "USD", 1);
    expect(r.completo).toBe(false);
    expect(r.monto).toBe(0);
    expect(r.fuente).toBe("sin-tc");
  });

  it("usa el fallback sólo si es confiable y lo audita", () => {
    expect(aMxn(10, "USD", null, { fallback: 18 })).toEqual({
      monto: 180, tc: 18, fuente: "tc-fallback", completo: true,
    });
    expect(aMxn(10, "USD", null, { fallback: 1 }).completo).toBe(false);
  });
});

describe("factorEntreMonedas", () => {
  it("misma moneda → 1", () => {
    expect(factorEntreMonedas("USD", "USD", {})).toBe(1);
  });

  it("USD → MXN usa el TC del dólar", () => {
    expect(factorEntreMonedas("USD", "MXN", { usd: 20 })).toBe(20);
  });

  it("EUR → USD cruza por MXN", () => {
    expect(factorEntreMonedas("EUR", "USD", { usd: 20, eur: 22 })).toBeCloseTo(1.1, 6);
  });

  it("regresa null si falta un TC confiable", () => {
    expect(factorEntreMonedas("EUR", "MXN", { usd: 20 })).toBeNull();
    expect(factorEntreMonedas("USD", "MXN", { usd: 1 })).toBeNull();
  });
});
