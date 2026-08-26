/**
 * Convención mexicana del TC en traspasos: la cifra capturada es la misma en
 * ambos sentidos del par; sólo cambia el multiplicador derivado.
 */
import { describe, expect, it } from "vitest";
import { etiquetaTc, multiplicadorOrigenDestino, parTc } from "../tcPar";
import { sugerirTcQuote } from "@/features/tesoreria/hooks/useTraspasoForm";

describe("tcPar", () => {
  it("elige la divisa fuerte como base del par", () => {
    expect(parTc("MXN", "USD")).toEqual({ base: "USD", quote: "MXN" });
    expect(parTc("USD", "MXN")).toEqual({ base: "USD", quote: "MXN" });
    expect(parTc("EUR", "USD")).toEqual({ base: "EUR", quote: "USD" });
  });

  it("devuelve null cuando el par no aplica", () => {
    expect(parTc("MXN", "MXN")).toBeNull();
    expect(parTc("MXN", null)).toBeNull();
  });

  it("etiqueta la captura en pesos por dólar", () => {
    expect(etiquetaTc(parTc("MXN", "USD"))).toBe("Tipo de cambio (MXN por 1 USD)");
  });

  it("deriva el multiplicador en ambos sentidos con la misma cifra", () => {
    const par = parTc("MXN", "USD");
    // Compras dólares con pesos: 10,000 MXN / 18.42
    expect(multiplicadorOrigenDestino(par, "MXN", 18.42)).toBeCloseTo(1 / 18.42, 10);
    // Vendes dólares: 1,000 USD * 18.42
    expect(multiplicadorOrigenDestino(par, "USD", 18.42)).toBe(18.42);
  });

  it("rechaza cotizaciones inválidas", () => {
    const par = parTc("MXN", "USD");
    expect(multiplicadorOrigenDestino(par, "MXN", 0)).toBeNull();
    expect(multiplicadorOrigenDestino(null, "MXN", 18.42)).toBeNull();
    expect(multiplicadorOrigenDestino(par, "EUR", 18.42)).toBeNull();
  });
});

describe("sugerirTcQuote", () => {
  const tc = { usdMxn: 18.42, eurMxn: 20.5 };

  it("sugiere pesos por dólar sin importar el sentido", () => {
    expect(sugerirTcQuote(tc, parTc("MXN", "USD"))).toBe(18.42);
    expect(sugerirTcQuote(tc, parTc("USD", "MXN"))).toBe(18.42);
  });

  it("sugiere dólares por euro en el par EUR/USD", () => {
    expect(sugerirTcQuote(tc, parTc("USD", "EUR"))).toBeCloseTo(1.1129, 4);
  });

  it("devuelve null sin TC o sin par", () => {
    expect(sugerirTcQuote(null, parTc("MXN", "USD"))).toBeNull();
    expect(sugerirTcQuote(tc, null)).toBeNull();
    expect(sugerirTcQuote({ usdMxn: 18.42, eurMxn: null }, parTc("MXN", "EUR"))).toBeNull();
  });
});
