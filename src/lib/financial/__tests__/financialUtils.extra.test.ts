import { describe, it, expect } from "vitest";
import {
  TASA_IVA,
  TASAS_IVA_MX,
  subtotalLinea,
  calcularSubtotal,
  sumarSubtotales,
  sumarMontos,
  calcularIVA,
  calcularTotalConIVA,
  calcularMargen,
  calcularUtilidad,
  convertirAMXN,
  convertirAUSD,
  resolverTasaConcepto,
} from "@/lib/financial/financialUtils";

describe("financialUtils.extra — constantes", () => {
  it("TASA_IVA es 0.16", () => {
    expect(TASA_IVA).toBe(0.16);
  });

  it("TASAS_IVA_MX contiene los tres niveles", () => {
    const valores = TASAS_IVA_MX.map((t) => t.value);
    expect(valores).toContain(0);
    expect(valores).toContain(0.08);
    expect(valores).toContain(0.16);
  });
});

describe("financialUtils.extra — subtotalLinea / calcularSubtotal", () => {
  it("retorna producto exacto de enteros", () => {
    expect(subtotalLinea(5, 100)).toBe(500);
  });

  it("maneja decimales sin drift (3 × 0.1)", () => {
    expect(subtotalLinea(3, 0.1)).toBeCloseTo(0.3, 10);
  });

  it("calcularSubtotal es alias de subtotalLinea", () => {
    expect(calcularSubtotal(7, 13.5)).toBe(subtotalLinea(7, 13.5));
  });

  it("cantidad cero devuelve 0", () => {
    expect(subtotalLinea(0, 999)).toBe(0);
  });
});

describe("financialUtils.extra — sumarSubtotales", () => {
  it("suma lista de items correctamente", () => {
    const items = [
      { cantidad: 2, precioUnitario: 50 },
      { cantidad: 3, precioUnitario: 10 },
    ];
    const resultado = sumarSubtotales(items, (i) => i);
    expect(resultado).toBe(130);
  });

  it("lista vacía devuelve 0", () => {
    type Row = { cantidad: number; precioUnitario: number };
    expect(sumarSubtotales<Row>([], (i) => i)).toBe(0);
  });
});

describe("financialUtils.extra — sumarMontos", () => {
  it("suma lista de montos", () => {
    expect(sumarMontos([10, 20, 30])).toBe(60);
  });

  it("lista vacía devuelve 0", () => {
    expect(sumarMontos([])).toBe(0);
  });

  it("suma con decimales sin drift", () => {
    expect(sumarMontos([0.1, 0.2])).toBeCloseTo(0.3, 10);
  });
});

describe("financialUtils.extra — calcularIVA / calcularTotalConIVA", () => {
  it("calcularIVA al 16% sobre 1000 = 160", () => {
    expect(calcularIVA(1000, 0.16)).toBe(160);
  });

  it("calcularIVA tasa cero = 0", () => {
    expect(calcularIVA(500, 0)).toBe(0);
  });

  it("calcularTotalConIVA al 16% sobre 1000 = 1160", () => {
    expect(calcularTotalConIVA(1000, 0.16)).toBe(1160);
  });

  it("calcularTotalConIVA tasa 8% sobre 100 = 108", () => {
    expect(calcularTotalConIVA(100, 0.08)).toBe(108);
  });
});

describe("financialUtils.extra — calcularMargen / calcularUtilidad", () => {
  it("margen 50% cuando venta duplica costo", () => {
    expect(calcularMargen(200, 100)).toBeCloseTo(50, 4);
  });

  it("margen 0 cuando venta es 0", () => {
    expect(calcularMargen(0, 100)).toBe(0);
  });

  it("utilidad positiva correcta", () => {
    expect(calcularUtilidad(300, 200)).toBe(100);
  });

  it("utilidad negativa (pérdida)", () => {
    expect(calcularUtilidad(100, 200)).toBe(-100);
  });
});

describe("financialUtils.extra — convertirAMXN / convertirAUSD", () => {
  it("MXN sin conversión devuelve mismo monto", () => {
    expect(convertirAMXN(500, "MXN", 17, 19)).toBe(500);
  });

  it("USD a MXN con TC 17", () => {
    expect(convertirAMXN(100, "USD", 17, 19)).toBe(1700);
  });

  it("EUR a MXN con TC 19", () => {
    expect(convertirAMXN(100, "EUR", 17, 19)).toBe(1900);
  });

  it("USD sin conversión devuelve mismo monto", () => {
    expect(convertirAUSD(200, "USD", 17, 19)).toBe(200);
  });

  it("MXN a USD con TC 17", () => {
    expect(convertirAUSD(1700, "MXN", 17, 19)).toBeCloseTo(100, 2);
  });
});

describe("financialUtils.extra — resolverTasaConcepto", () => {
  it("usa tasa_iva_aplicada cuando está definida", () => {
    expect(resolverTasaConcepto({ tasa_iva_aplicada: 0.08 }, 0.16)).toBe(0.08);
  });

  it("usa 0 explícito en tasa_iva_aplicada (no lo ignora)", () => {
    expect(resolverTasaConcepto({ tasa_iva_aplicada: 0 }, 0.16)).toBe(0);
  });

  it("cae a fallback cuando aplica_iva=true y tasa_iva_aplicada es null", () => {
    expect(resolverTasaConcepto({ tasa_iva_aplicada: null, aplica_iva: true }, 0.16)).toBe(0.16);
  });

  it("devuelve 0 cuando aplica_iva=false y sin tasa_iva_aplicada", () => {
    expect(resolverTasaConcepto({ aplica_iva: false }, 0.16)).toBe(0);
  });

  it("devuelve 0 cuando concepto sin campos", () => {
    expect(resolverTasaConcepto({}, 0.16)).toBe(0);
  });
});
