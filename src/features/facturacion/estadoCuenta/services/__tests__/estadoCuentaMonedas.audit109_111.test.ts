import { describe, expect, it } from "vitest";
import { montoCobroEnMonedaFactura } from "@/lib/financial/montoCobroEnMonedaFactura";
import { mapFacturaEstadoCuenta, type RawFactura, type RawPago } from "../estadoCuentaTypes";
import { calcularKpisEstadoCuenta } from "../estadoCuentaAggregates";
import { calcularAging } from "../estadoCuentaAging";

function factura(overrides: Partial<RawFactura> = {}): RawFactura {
  return {
    id: "usd1", numero: "AUD109", cliente_id: "c1", cliente_nombre: "Cliente", expediente: "",
    moneda: "USD", tipo_cambio: 18.1903, total: 1, fecha_emision: "2026-10-01",
    fecha_vencimiento: "2020-01-01", estado: "Emitida", pagos_factura: [], factura_notas_credito: [],
    ...overrides,
  };
}
function pago(overrides: Partial<RawPago> = {}): RawPago {
  return {
    id: "p1", fecha_pago: "2026-10-05", monto: 20, moneda: "MXN", tipo_cambio: 20,
    monto_aplicado_factura: 1, forma_pago: "03", referencia: null, estado_rep: "Timbrado", deleted_at: null,
    ...overrides,
  };
}

describe("AUD109: anticipos del estado de cuenta", () => {
  it("MXN20 / TC20 liquida USD1 sin generar USD399 de crédito", () => {
    const row = mapFacturaEstadoCuenta(factura({ estado: "Pagada", pagos_factura: [pago()] }));
    expect(row).toMatchObject({ pagado: 1, saldo: 0 });
    expect(row.pagos[0].monto_no_aplicado).toBe(0);
    expect(calcularKpisEstadoCuenta([row]).aFavor).toEqual({ mxn: 0, usd: 0, eur: 0 });
  });

  it.each([
    { origen: "MXN", destino: "USD", monto: 30, tc: 20, tcFactura: 18, esperado: 1.5 },
    { origen: "USD", destino: "MXN", monto: 2, tc: 20, tcFactura: 1, esperado: 40 },
    { origen: "MXN", destino: "EUR", monto: 30, tc: 25, tcFactura: 20, esperado: 1.5 },
    { origen: "EUR", destino: "MXN", monto: 2, tc: 22, tcFactura: 1, esperado: 44 },
    { origen: "USD", destino: "EUR", monto: 2, tc: 20, tcFactura: 25, esperado: 1.6 },
    { origen: "EUR", destino: "USD", monto: 2, tc: 25, tcFactura: 20, esperado: 2.5 },
    { origen: "EUR", destino: "EUR", monto: 3, tc: 0, tcFactura: 0, esperado: 3 },
  ])("convierte $origen→$destino conforme al SQL canónico", ({ origen, destino, monto, tc, tcFactura, esperado }) => {
    expect(montoCobroEnMonedaFactura(monto, origen, tc, destino, tcFactura)).toBe(esperado);
  });

  it("preserva el redondeo de aplicación a cuatro decimales antes del excedente", () => {
    const row = mapFacturaEstadoCuenta(factura({ pagos_factura: [pago({
      monto: 10.075, tipo_cambio: 20, monto_aplicado_factura: 0.5038,
    })] }));
    expect(row.pagos[0].monto_no_aplicado).toBe(0);
  });

  it("conserva sólo el excedente real en moneda de factura", () => {
    const row = mapFacturaEstadoCuenta(factura({ pagos_factura: [pago({ monto: 30 })] }));
    expect(row.pagos[0].monto_no_aplicado).toBe(0.5);
    expect(calcularKpisEstadoCuenta([row]).aFavor.usd).toBe(0.5);
  });

  it.each([null, 0, -1, 1, 0.05, Number.NaN, Number.POSITIVE_INFINITY])(
    "no inventa crédito cuando el TC de cruce es %s", (tc) => {
      const row = mapFacturaEstadoCuenta(factura({ pagos_factura: [pago({ tipo_cambio: tc })] }));
      expect(row.pagos[0].monto_no_aplicado).toBe(0);
    },
  );

  it.each(["JPY", "", "usd"])("no calcula crédito para moneda no admitida %s", (moneda) => {
    const row = mapFacturaEstadoCuenta(factura({ pagos_factura: [pago({ moneda })] }));
    expect(row.pagos[0].monto_no_aplicado).toBe(0);
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, -1])("no inventa crédito con monto o aplicación inválida %s", (valor) => {
    const monto = mapFacturaEstadoCuenta(factura({ pagos_factura: [pago({ monto: valor })] }));
    const aplicado = mapFacturaEstadoCuenta(factura({ pagos_factura: [pago({ monto_aplicado_factura: valor })] }));
    expect(monto.pagos[0].monto_no_aplicado).toBe(0);
    expect(aplicado.pagos[0].monto_no_aplicado).toBe(0);
  });

  it("no inventa crédito si falta la tasa de factura necesaria para el cruce EUR", () => {
    const row = mapFacturaEstadoCuenta(factura({ moneda: "EUR", tipo_cambio: null, pagos_factura: [pago()] }));
    expect(row.pagos[0].monto_no_aplicado).toBe(0);
  });

  it("excluye pagos eliminados y REP cancelados de saldo y anticipos", () => {
    const row = mapFacturaEstadoCuenta(factura({ estado: "Pagada", pagos_factura: [
      pago({ monto: 200, estado_rep: " Cancelado " }),
      pago({ id: "p2", monto: 200, deleted_at: "2026-10-05" }),
    ] }));
    expect(row.pagos).toEqual([]);
    expect(row.saldo).toBe(1);
    expect(row.estatus_cobranza).toBe("Vencida");
    expect(calcularKpisEstadoCuenta([row]).vencido.usd).toBe(1);
    expect(calcularKpisEstadoCuenta([row]).aFavor.usd).toBe(0);
  });
});

describe("AUD111: EUR en adeudo, vencido, anticipos y aging", () => {
  it("cuenta el importe EUR junto con la factura en todos los agregados", () => {
    const eur = mapFacturaEstadoCuenta(factura({ moneda: "EUR", tipo_cambio: 20, total: 3,
      pagos_factura: [pago({ monto: 40, monto_aplicado_factura: 1 })] }));
    expect(calcularKpisEstadoCuenta([eur])).toEqual({
      adeudado: { mxn: 0, usd: 0, eur: 2 }, vencido: { mxn: 0, usd: 0, eur: 2 },
      aFavor: { mxn: 0, usd: 0, eur: 1 }, facturasVencidas: 1, facturasAdeudadas: 1,
    });
    expect(calcularAging([eur]).find((b) => b.id === "mas_90"))
      .toMatchObject({ mxn: 0, usd: 0, eur: 2, conteo: 1 });
  });

  it("no pierde EUR vigente al combinar las tres monedas", () => {
    const rows = (["MXN", "USD", "EUR"] as const).map((moneda) => mapFacturaEstadoCuenta(factura({
      moneda, tipo_cambio: 20, fecha_vencimiento: "2099-01-01",
    })));
    expect(calcularKpisEstadoCuenta(rows).adeudado).toEqual({ mxn: 1, usd: 1, eur: 1 });
    expect(calcularAging(rows).find((b) => b.id === "vigente"))
      .toMatchObject({ mxn: 1, usd: 1, eur: 1, conteo: 3 });
  });
});
