import { describe, it, expect } from "vitest";
import { similitudDescripcion, cercaniaMonto, scoreCompuesto } from "../similitud";

describe("similitudDescripcion", () => {
  it("es 1.0 para textos equivalentes tras normalizar", () => {
    expect(similitudDescripcion("Flete Marítimo", "flete maritimo")).toBe(1);
  });
  it("da score alto para variantes/abreviaturas", () => {
    const s = similitudDescripcion(
      "Flete marítimo Shanghái-Manzanillo",
      "flete maritimo mzo shanghai",
    );
    expect(s).toBeGreaterThan(0.55);
  });
  it("baja a 0 para textos sin relación", () => {
    expect(similitudDescripcion("Almacenaje puerto", "Honorarios agente aduanal")).toBeLessThan(0.3);
  });
  it("maneja vacíos", () => {
    expect(similitudDescripcion("", "flete")).toBe(0);
    expect(similitudDescripcion("flete", "")).toBe(0);
  });
});

describe("cercaniaMonto", () => {
  it("1 cuando son iguales", () => {
    expect(cercaniaMonto(1000, 1000)).toBe(1);
  });
  it("≥ 0.8 dentro del ±5%", () => {
    expect(cercaniaMonto(1000, 1050)).toBeGreaterThanOrEqual(0.8);
  });
  it("≈ 0 en ±25%", () => {
    expect(cercaniaMonto(1000, 1250)).toBeCloseTo(0, 2);
  });
  it("cero si alguno es no positivo", () => {
    expect(cercaniaMonto(0, 100)).toBe(0);
    expect(cercaniaMonto(100, 0)).toBe(0);
  });
});

describe("scoreCompuesto", () => {
  it("aplica penalización dura por moneda distinta", () => {
    const s = scoreCompuesto({
      descripcionA: "flete", descripcionB: "flete",
      montoA: 100, montoB: 100, monedaA: "MXN", monedaB: "USD",
    });
    expect(s).toBeLessThan(0.6);
  });
  it("da ≥0.9 para match perfecto misma moneda", () => {
    const s = scoreCompuesto({
      descripcionA: "flete maritimo", descripcionB: "Flete Marítimo",
      montoA: 1000, montoB: 1000, monedaA: "MXN", monedaB: "MXN",
    });
    expect(s).toBeGreaterThanOrEqual(0.9);
  });
});
