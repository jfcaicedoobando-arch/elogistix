import { describe, expect, it } from "vitest";
import { notasCreditoMonedaFactura } from "../notasCreditoMonedaFactura";

const nota = (moneda: string, monto: number, tipo_cambio: number | null = null) => ({ moneda, monto, tipo_cambio });

describe("NC: paridad de conversión con nc_convertida_a_moneda_factura", () => {
  it.each([
    ["MXN", null, nota("USD", 58, 20), 1160],
    ["USD", 20, nota("MXN", 1160, 99), 58],
    ["USD", 20, nota("EUR", 50, 22), 55],
    ["EUR", 22, nota("USD", 55, 20), 50],
    ["USD", null, nota("USD", 58), 58],
    ["EUR", null, nota("EUR", 58), 58],
    ["MXN", null, nota("MXN", 58), 58],
  ] as const)("convierte a %s con TC factura %s", (moneda, tc, nc, esperado) => {
    const original = { ...nc };
    const result = notasCreditoMonedaFactura([nc], moneda, tc);
    expect(result.total).toBe(esperado);
    expect(result.notas[0].monto).toBe(esperado);
    expect(nc).toEqual(original);
  });

  it("suma créditos antes de redondear, igual que SUM(nc_convertida...) del servidor", () => {
    const result = notasCreditoMonedaFactura([nota("MXN", 1), nota("MXN", 1), nota("MXN", 1)], "USD", 3);
    expect(result.total).toBe(1);
    expect(result.notas[0].monto).toBeCloseTo(1 / 3);
  });

  it.each([null, 0, 1, -20, Number.NaN, Number.POSITIVE_INFINITY])("rechaza TC histórico inválido %s en ambas direcciones", (tc) => {
    expect(() => notasCreditoMonedaFactura([nota("USD", 58, tc)], "MXN", null)).toThrow("LC_NC_MONEDA_SIN_TC");
    expect(() => notasCreditoMonedaFactura([nota("MXN", 1160, 20)], "USD", tc)).toThrow("LC_NC_MONEDA_SIN_TC");
  });

  it("no sustituye TC faltante de EUR por el TC de la factura USD", () => {
    expect(() => notasCreditoMonedaFactura([nota("EUR", 58)], "USD", 20)).toThrow("LC_NC_MONEDA_SIN_TC");
    expect(() => notasCreditoMonedaFactura([nota("EUR", 58, 22)], "USD", null)).toThrow("LC_NC_MONEDA_SIN_TC");
  });

  it.each(["", "CAD", "XXX"])("rechaza moneda no soportada %s sin tratarla como MXN", (moneda) => {
    expect(() => notasCreditoMonedaFactura([nota(moneda, 58, 20)], "MXN", null)).toThrow("LC_NC_MONEDA_NO_SOPORTADA");
  });
});
