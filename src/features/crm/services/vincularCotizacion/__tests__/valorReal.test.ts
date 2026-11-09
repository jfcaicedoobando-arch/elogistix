import { describe, it, expect } from "vitest";
import { calcularValorReal } from "../valorReal";

const c = (estado: string, subtotal: number, moneda = "MXN", updated_at = "2026-11-01") => ({
  estado, subtotal, moneda, updated_at,
});

describe("calcularValorReal", () => {
  it("toma el subtotal de la cotización aceptada", () => {
    expect(calcularValorReal([c("Aceptada", 15000)], "MXN")).toEqual({ valor: 15000, moneda: "MXN" });
  });
  it("suma varias aceptadas en la misma moneda e ignora rechazadas", () => {
    expect(
      calcularValorReal([c("Aceptada", 100.1), c("En operación", 200.2), c("Rechazada", 999)], "MXN"),
    ).toEqual({ valor: 300.3, moneda: "MXN" });
  });
  it("sin coincidencia de moneda usa la aceptada más reciente", () => {
    expect(
      calcularValorReal([c("Aceptada", 10, "USD", "2026-10-01"), c("Aceptada", 20, "EUR", "2026-11-02")], "MXN"),
    ).toEqual({ valor: 20, moneda: "EUR" });
  });
  it("sin aceptadas no hay valor", () => {
    expect(calcularValorReal([c("Enviada", 10)], "MXN")).toBeNull();
  });
});
