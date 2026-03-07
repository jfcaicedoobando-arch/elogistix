import { describe, it, expect } from "vitest";
import {
  calcularSubtotal,
  calcularIVA,
  calcularTotalConIVA,
  calcularMargen,
  calcularUtilidad,
  convertirAMXN,
  convertirAUSD,
  TASA_IVA,
} from "@/lib/financialUtils";

describe("calcularIVA", () => {
  it("aplica 16% por defecto", () => {
    expect(calcularIVA(1000)).toBeCloseTo(160);
  });
  it("acepta tasa personalizada", () => {
    expect(calcularIVA(1000, 0.08)).toBeCloseTo(80);
  });
  it("retorna 0 para monto 0", () => {
    expect(calcularIVA(0)).toBe(0);
  });
});

describe("calcularTotalConIVA", () => {
  it("suma IVA 16% por defecto", () => {
    expect(calcularTotalConIVA(1000)).toBeCloseTo(1160);
  });
  it("acepta tasa personalizada", () => {
    expect(calcularTotalConIVA(500, 0.10)).toBeCloseTo(550);
  });
  it("retorna 0 para monto 0", () => {
    expect(calcularTotalConIVA(0)).toBe(0);
  });
});

describe("convertirAMXN", () => {
  it("convierte USD a MXN", () => {
    expect(convertirAMXN(100, "USD", 17.5)).toBeCloseTo(1750);
  });
  it("convierte EUR a MXN", () => {
    expect(convertirAMXN(100, "EUR", 17.5, 19.0)).toBeCloseTo(1900);
  });
  it("retorna el mismo monto para MXN", () => {
    expect(convertirAMXN(500, "MXN", 17.5, 19.0)).toBe(500);
  });
  it("maneja monto 0", () => {
    expect(convertirAMXN(0, "USD", 17.5)).toBe(0);
  });
});

describe("convertirAUSD", () => {
  it("convierte MXN a USD", () => {
    expect(convertirAUSD(1750, "MXN", 17.5, 19.0)).toBeCloseTo(100);
  });
  it("convierte EUR a USD", () => {
    expect(convertirAUSD(100, "EUR", 17.5, 19.0)).toBeCloseTo((100 * 19.0) / 17.5);
  });
  it("retorna el mismo monto para USD", () => {
    expect(convertirAUSD(100, "USD", 17.5, 19.0)).toBe(100);
  });
});

describe("calcularSubtotal", () => {
  it("multiplica cantidad por precio", () => {
    expect(calcularSubtotal(5, 200)).toBe(1000);
  });
});

describe("calcularMargen", () => {
  it("calcula porcentaje correcto", () => {
    expect(calcularMargen(1000, 800)).toBeCloseTo(20);
  });
  it("retorna 0 si venta es 0", () => {
    expect(calcularMargen(0, 100)).toBe(0);
  });
  it("retorna negativo si costo > venta", () => {
    expect(calcularMargen(100, 200)).toBeLessThan(0);
  });
});

describe("calcularUtilidad", () => {
  it("resta costo de venta", () => {
    expect(calcularUtilidad(1000, 700)).toBe(300);
  });
});
