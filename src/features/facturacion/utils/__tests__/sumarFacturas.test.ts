import { describe, it, expect } from "vitest";
import { sumarFacturasPorMoneda } from "../sumarFacturas";

describe("sumarFacturasPorMoneda", () => {
  it("suma MXN y USD por separado e ignora canceladas", () => {
    const r = sumarFacturasPorMoneda([
      { total: 100, moneda: "MXN", estado: "Emitida" },
      { total: 50, moneda: "USD", estado: "Pagada" },
      { total: "200", moneda: "MXN", estado: "Emitida" },
      { total: 999, moneda: "MXN", estado: "Cancelada" },
      { total: 25, moneda: "USD", estado: "Vencida" },
    ]);
    expect(r.totalMxn).toBe(300);
    expect(r.totalUsd).toBe(75);
    expect(r.conteo).toBe(4);
    expect(r.conteoCanceladas).toBe(1);
  });

  it("devuelve ceros con arreglo vacío", () => {
    expect(sumarFacturasPorMoneda([])).toEqual({
      conteo: 0, totalMxn: 0, totalUsd: 0, conteoCanceladas: 0,
    });
  });

  it("trata valores no numéricos como 0", () => {
    const r = sumarFacturasPorMoneda([
      { total: "abc", moneda: "MXN", estado: "Emitida" },
      { total: 10, moneda: "EUR", estado: "Emitida" },
    ]);
    expect(r.totalMxn).toBe(0);
    expect(r.totalUsd).toBe(0);
    expect(r.conteo).toBe(2);
  });
});
