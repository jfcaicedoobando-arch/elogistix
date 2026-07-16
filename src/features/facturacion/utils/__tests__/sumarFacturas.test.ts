import { describe, it, expect } from "vitest";
import { sumarFacturasPorMoneda } from "../sumarFacturas";

describe("sumarFacturasPorMoneda", () => {
  it("suma MXN y USD por separado e ignora canceladas", () => {
    const r = sumarFacturasPorMoneda([
      { total: 100, moneda: "MXN", estado: "Emitida" },
      { total: 50, moneda: "USD", estado: "Pagada", tipo_cambio: 20 },
      { total: "200", moneda: "MXN", estado: "Emitida" },
      { total: 999, moneda: "MXN", estado: "Cancelada" },
      { total: 25, moneda: "USD", estado: "Vencida", tipo_cambio: 20 },
    ]);
    expect(r.totalMxn).toBe(300);
    expect(r.totalUsd).toBe(75);
    expect(r.conteo).toBe(4);
    expect(r.conteoCanceladas).toBe(1);
    expect(r.mxnEquivalente).toBe(1800);
    expect(r.facturasSinTc).toBe(0);
  });

  it("devuelve ceros con arreglo vacío", () => {
    expect(sumarFacturasPorMoneda([])).toEqual({
      conteo: 0,
      totalMxn: 0,
      totalUsd: 0,
      conteoCanceladas: 0,
      mxnEquivalente: 0,
      facturasSinTc: 0,
    });
  });

  it("USD sin tipo_cambio cuenta facturasSinTc cuando no hay fallback", () => {
    const r = sumarFacturasPorMoneda([
      { total: 100, moneda: "USD", estado: "Emitida", tipo_cambio: null },
      { total: 50, moneda: "USD", estado: "Emitida" },
    ]);
    expect(r.totalUsd).toBe(150);
    expect(r.mxnEquivalente).toBe(0);
    expect(r.facturasSinTc).toBe(2);
  });

  it("USD sin tipo_cambio usa fallbackUsdMxn", () => {
    const r = sumarFacturasPorMoneda(
      [
        { total: 100, moneda: "USD", estado: "Emitida", tipo_cambio: null },
        { total: 100, moneda: "USD", estado: "Emitida", tipo_cambio: 18 },
      ],
      { fallbackUsdMxn: 20 },
    );
    expect(r.mxnEquivalente).toBe(3800);
    expect(r.facturasSinTc).toBe(0);
  });

  it("USD con tipo_cambio=1 se considera inválido y usa fallback", () => {
    const r = sumarFacturasPorMoneda(
      [
        { total: 100, moneda: "USD", estado: "Emitida", tipo_cambio: 1 },
        { total: 50, moneda: "USD", estado: "Emitida", tipo_cambio: 0.5 },
      ],
      { fallbackUsdMxn: 17.5 },
    );
    // (100 + 50) * 17.5 = 2625
    expect(r.mxnEquivalente).toBe(2625);
    expect(r.facturasSinTc).toBe(0);
  });

  it("USD con tipo_cambio=1 sin fallback cuenta como facturasSinTc", () => {
    const r = sumarFacturasPorMoneda([
      { total: 100, moneda: "USD", estado: "Emitida", tipo_cambio: 1 },
    ]);
    expect(r.mxnEquivalente).toBe(0);
    expect(r.facturasSinTc).toBe(1);
  });

  it("trata valores no numéricos como 0 y monedas raras no rompen MXN equivalente", () => {
    const r = sumarFacturasPorMoneda([
      { total: "abc", moneda: "MXN", estado: "Emitida" },
      { total: 10, moneda: "EUR", estado: "Emitida" },
    ]);
    expect(r.totalMxn).toBe(0);
    expect(r.totalUsd).toBe(0);
    expect(r.mxnEquivalente).toBe(0);
    expect(r.conteo).toBe(2);
  });

  it("ignora borradores (no cuentan como facturado ni como canceladas)", () => {
    const r = sumarFacturasPorMoneda([
      { total: 100, moneda: "MXN", estado: "Emitida" },
      { total: 500, moneda: "MXN", estado: "Borrador" },
      { total: 200, moneda: "USD", estado: "Borrador", tipo_cambio: 20 },
      { total: 999, moneda: "MXN", estado: "Cancelada" },
    ]);
    expect(r.totalMxn).toBe(100);
    expect(r.totalUsd).toBe(0);
    expect(r.mxnEquivalente).toBe(100);
    expect(r.conteo).toBe(1);
    expect(r.conteoCanceladas).toBe(1);
  });
});
