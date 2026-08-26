import { describe, it, expect } from "vitest";
import {
  parTc,
  multiplicadorOrigenDestino,
  etiquetaTc,
  etiquetaTcContraMxn,
  ayudaTcContraMxn,
} from "../tcPar";

describe("tcPar — convención mexicana (pesos por 1 divisa fuerte)", () => {
  it("ordena el par con la divisa fuerte como base", () => {
    expect(parTc("MXN", "USD")).toEqual({ base: "USD", quote: "MXN" });
    expect(parTc("USD", "MXN")).toEqual({ base: "USD", quote: "MXN" });
    expect(parTc("MXN", "EUR")).toEqual({ base: "EUR", quote: "MXN" });
    expect(parTc("USD", "EUR")).toEqual({ base: "EUR", quote: "USD" });
  });

  it("devuelve null con monedas iguales o inválidas", () => {
    expect(parTc("MXN", "MXN")).toBeNull();
    expect(parTc("JPY", "MXN")).toBeNull();
    expect(parTc(null, undefined)).toBeNull();
  });

  it("etiqueta el par contra MXN para USD y EUR", () => {
    expect(etiquetaTcContraMxn("USD")).toBe("Tipo de cambio (MXN por 1 USD)");
    expect(etiquetaTcContraMxn("EUR")).toBe("Tipo de cambio (MXN por 1 EUR)");
  });

  it("cae al genérico con MXN o sin moneda", () => {
    expect(etiquetaTcContraMxn("MXN")).toBe("Tipo de cambio");
    expect(etiquetaTcContraMxn(null)).toBe("Tipo de cambio");
    expect(etiquetaTc(null)).toBe("Tipo de cambio");
  });

  it("da ayuda sólo cuando la cotización es en pesos", () => {
    expect(ayudaTcContraMxn("USD")).toBe("Pesos que se pagan por 1 USD.");
    expect(ayudaTcContraMxn("MXN")).toBeNull();
  });

  it("deriva el multiplicador origen→destino en ambos sentidos", () => {
    const par = parTc("MXN", "USD");
    expect(multiplicadorOrigenDestino(par, "USD", 18.42)).toBe(18.42);
    expect(multiplicadorOrigenDestino(par, "MXN", 18.42)).toBeCloseTo(1 / 18.42, 10);
    expect(multiplicadorOrigenDestino(par, "USD", 0)).toBeNull();
    expect(multiplicadorOrigenDestino(null, "USD", 18.42)).toBeNull();
  });
});
