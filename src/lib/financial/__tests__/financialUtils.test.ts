import { describe, it, expect } from "vitest";
import {
  calcularSubtotal,
  calcularIVA,
  calcularTotalConIVA,
  calcularMargen,
  calcularUtilidad,
  convertirAMXN,
  convertirAUSD,
  resolverTasaConcepto,
  subtotalLinea,
  sumarSubtotales,
  sumarMontos,
} from "@/lib/financial/financialUtils";

describe("calcularIVA", () => {
  it("aplica la tasa indicada explícitamente", () => {
    expect(calcularIVA(1000, 0.16)).toBeCloseTo(160);
  });
  it("acepta tasa personalizada (8%)", () => {
    expect(calcularIVA(1000, 0.08)).toBeCloseTo(80);
  });
  it("respeta tasa 0% (exento)", () => {
    expect(calcularIVA(1000, 0)).toBe(0);
  });
  it("retorna 0 para monto 0", () => {
    expect(calcularIVA(0, 0.16)).toBe(0);
  });
});

describe("calcularTotalConIVA", () => {
  it("suma IVA con la tasa indicada", () => {
    expect(calcularTotalConIVA(1000, 0.16)).toBeCloseTo(1160);
  });
  it("acepta tasa personalizada", () => {
    expect(calcularTotalConIVA(500, 0.10)).toBeCloseTo(550);
  });
  it("respeta tasa 0%", () => {
    expect(calcularTotalConIVA(1000, 0)).toBe(1000);
  });
  it("retorna 0 para monto 0", () => {
    expect(calcularTotalConIVA(0, 0.16)).toBe(0);
  });
});

describe("resolverTasaConcepto", () => {
  it("prioriza tasa_iva_aplicada cuando está definida", () => {
    expect(resolverTasaConcepto({ tasa_iva_aplicada: 0.08, aplica_iva: true }, 0.16)).toBe(0.08);
  });
  it("respeta tasa 0 explícita (no la toma como ausente)", () => {
    expect(resolverTasaConcepto({ tasa_iva_aplicada: 0, aplica_iva: true }, 0.16)).toBe(0);
  });
  it("usa el fallback global cuando sólo está aplica_iva=true", () => {
    expect(resolverTasaConcepto({ aplica_iva: true }, 0.16)).toBe(0.16);
  });
  it("retorna 0 cuando no hay tasa ni aplica_iva", () => {
    expect(resolverTasaConcepto({ aplica_iva: false }, 0.16)).toBe(0);
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

describe("subtotalLinea", () => {
  it("multiplica cantidad por precio unitario", () => {
    expect(subtotalLinea(3, 99.99)).toBeCloseTo(299.97, 2);
  });
  it("redondea a 2 decimales por fila (sin drift)", () => {
    // 0.1 * 3 en float plano = 0.30000000000000004
    expect(subtotalLinea(3, 0.1)).toBe(0.3);
  });
  it("calcularSubtotal delega en subtotalLinea", () => {
    expect(calcularSubtotal(3, 0.1)).toBe(subtotalLinea(3, 0.1));
  });
});

describe("sumarSubtotales", () => {
  it("acumula sin drift con cantidades fraccionarias", () => {
    // Reducir con `+` plano daría 0.30000000000000004
    const items = [
      { cant: 1, pu: 0.1 },
      { cant: 1, pu: 0.1 },
      { cant: 1, pu: 0.1 },
    ];
    const total = sumarSubtotales(items, (i) => ({ cantidad: i.cant, precioUnitario: i.pu }));
    expect(total).toBe(0.3);
  });
  it("retorna 0 con lista vacía", () => {
    expect(sumarSubtotales([], () => ({ cantidad: 0, precioUnitario: 0 }))).toBe(0);
  });
  it("coincide con DialogRegistrarPago: 3 × 33.33 = 99.99", () => {
    const items = [{ q: 3, p: 33.33 }];
    expect(sumarSubtotales(items, (i) => ({ cantidad: i.q, precioUnitario: i.p }))).toBe(99.99);
  });
});

describe("sumarMontos", () => {
  it("elimina drift de punto flotante en suma de montos", () => {
    expect(sumarMontos([0.1, 0.2, 0.3, 0.4])).toBe(1.0);
  });
  it("retorna 0 con lista vacía", () => {
    expect(sumarMontos([])).toBe(0);
  });
  it("acumula montos pre-calculados (ej. IVA por fila)", () => {
    expect(sumarMontos([160, 80, 0])).toBe(240);
  });
});

