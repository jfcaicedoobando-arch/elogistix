import { describe, it, expect } from "vitest";
import { agruparMontosPorMoneda, agruparMontosPorMonedaOrdenado } from "@/features/crm/domain/montosPorMoneda";

describe("agruparMontosPorMoneda", () => {
  it("nunca mezcla montos de monedas distintas", () => {
    const acc = agruparMontosPorMoneda([
      { monto: 100, moneda: "MXN" },
      { monto: 50, moneda: "usd" },
      { monto: 200, moneda: "MXN" },
    ]);
    expect(acc.get("MXN")).toBe(300);
    expect(acc.get("USD")).toBe(50);
    expect(acc.size).toBe(2);
  });

  it("moneda ausente se asume MXN", () => {
    const acc = agruparMontosPorMoneda([{ monto: 10, moneda: null }]);
    expect(acc.get("MXN")).toBe(10);
  });

  it("versión ordenada devuelve arreglo alfabético", () => {
    const arr = agruparMontosPorMonedaOrdenado([
      { monto: 50, moneda: "USD" },
      { monto: 100, moneda: "EUR" },
    ]);
    expect(arr).toEqual([
      { moneda: "EUR", total: 100 },
      { moneda: "USD", total: 50 },
    ]);
  });

  it("lista vacía da mapa vacío", () => {
    expect(agruparMontosPorMoneda([]).size).toBe(0);
  });
});
