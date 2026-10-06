import { describe, expect, it } from "vitest";
import type { CxpPorPagarRow } from "../../types/bandejas";
import { resumirCxpPorPagar } from "../aggregates";

function factura(overrides: Partial<CxpPorPagarRow> = {}): CxpPorPagarRow {
  return {
    factura_id: "factura-eur", proveedor_id: "proveedor", proveedor_nombre: "Proveedor",
    proveedor_origen: null, folio_proveedor: null, embarque_id: null, expediente: null,
    fecha_emision: null, fecha_vencimiento: null, dias_para_vencer: 5,
    moneda: "EUR", total: 100, pagado: 0, saldo: 100, estado_captura: "Por aprobar",
    tipo_cambio_usd: 20, fecha_programada_pago: null, ...overrides,
  };
}

describe("CxP por pagar — TC documental EUR (extensión 85)", () => {
  it("incluye EUR 101 × TC 20 en el homologado sin advertencias falsas", () => {
    const rows = [factura(), factura({ factura_id: "segunda", total: 1, saldo: 1 })];
    const original = structuredClone(rows);

    expect(resumirCxpPorPagar(rows)).toEqual({
      total: 2, vencidas: 0, saldoMXN: 2020,
      porMoneda: { MXN: 0, USD: 0, EUR: 101 }, faltaTipoCambio: 0,
    });
    expect(rows).toEqual(original);
  });

  it("convierte el saldo pendiente y conserva desglose, USD, MXN y vencidas", () => {
    const result = resumirCxpPorPagar([
      factura({ total: 100, pagado: 25, saldo: 75, dias_para_vencer: -1 }),
      factura({ moneda: "USD", saldo: 10, tipo_cambio_usd: 18 }),
      factura({ moneda: "MXN", saldo: 50, tipo_cambio_usd: null }),
    ]);

    expect(result).toEqual({
      total: 3, vencidas: 1, saldoMXN: 1730,
      porMoneda: { MXN: 50, USD: 10, EUR: 75 }, faltaTipoCambio: 0,
    });
  });

  it.each([null, 0, -20, 1, 0.5, NaN, Infinity])(
    "excluye sólo el equivalente cuando el TC EUR es inválido: %s",
    (tipo_cambio_usd) => {
      const result = resumirCxpPorPagar([
        factura(), factura({ factura_id: "sin-tc", saldo: 1, tipo_cambio_usd }),
      ]);

      expect(result.saldoMXN).toBe(2000);
      expect(result.porMoneda.EUR).toBe(101);
      expect(result.faltaTipoCambio).toBe(1);
    },
  );
});
