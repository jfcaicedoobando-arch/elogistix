import { describe, it, expect } from "vitest";
import { calcularKpisEstadoCuenta } from "../estadoCuentaAggregates";
import type { FacturaEstadoCuenta } from "../estadoCuenta";

function factura(overrides: Partial<FacturaEstadoCuenta> = {}): FacturaEstadoCuenta {
  return {
    id: "f1",
    numero: "FAC-001",
    cliente_id: "c1",
    cliente_nombre: "Cliente Demo",
    expediente: "EMB-001",
    moneda: "MXN",
    total: 1000,
    pagado: 0,
    notas_credito_aplicadas: 0,
    saldo: 1000,
    fecha_emision: "2026-01-01",
    fecha_vencimiento: "2026-02-01",
    dias_vencido: 0,
    estatus_cobranza: "Vigente",
    pagos: [],
    notas_credito: [],
    ...overrides,
  } as FacturaEstadoCuenta;
}

describe("calcularKpisEstadoCuenta", () => {
  it("regresa ceros con arreglo vacío", () => {
    const k = calcularKpisEstadoCuenta([]);
    expect(k.adeudado).toEqual({ mxn: 0, usd: 0 });
    expect(k.vencido).toEqual({ mxn: 0, usd: 0 });
    expect(k.aFavor).toEqual({ mxn: 0, usd: 0 });
    expect(k.facturasAdeudadas).toBe(0);
    expect(k.facturasVencidas).toBe(0);
  });

  it("segrega adeudado por moneda", () => {
    const rows = [
      factura({ id: "a", moneda: "MXN", saldo: 500 }),
      factura({ id: "b", moneda: "USD", saldo: 300 }),
      factura({ id: "c", moneda: "MXN", saldo: 200 }),
    ];
    const k = calcularKpisEstadoCuenta(rows);
    expect(k.adeudado.mxn).toBeCloseTo(700, 2);
    expect(k.adeudado.usd).toBeCloseTo(300, 2);
    expect(k.facturasAdeudadas).toBe(3);
  });

  it("cuenta solamente vencidas con saldo > 0", () => {
    const rows = [
      factura({ id: "a", saldo: 100, estatus_cobranza: "Vencida" }),
      factura({ id: "b", saldo: 200, estatus_cobranza: "Vigente" }),
      factura({ id: "c", saldo: 0, estatus_cobranza: "Vencida" }),
    ];
    const k = calcularKpisEstadoCuenta(rows);
    expect(k.vencido.mxn).toBeCloseTo(100, 2);
    expect(k.facturasVencidas).toBe(1);
  });

  it("suma anticipos (monto_no_aplicado) por moneda", () => {
    const rows = [
      factura({
        moneda: "MXN",
        pagos: [
          { id: "p1", fecha_pago: "2026-01-05", monto_aplicado: 100, monto_no_aplicado: 50, forma_pago: null, referencia: null },
          { id: "p2", fecha_pago: "2026-01-06", monto_aplicado: 100, monto_no_aplicado: 0, forma_pago: null, referencia: null },
        ],
      }),
      factura({
        id: "u1",
        moneda: "USD",
        pagos: [
          { id: "p3", fecha_pago: "2026-01-05", monto_aplicado: 10, monto_no_aplicado: 25, forma_pago: null, referencia: null },
        ],
      }),
    ];
    const k = calcularKpisEstadoCuenta(rows);
    expect(k.aFavor.mxn).toBeCloseTo(50, 2);
    expect(k.aFavor.usd).toBeCloseTo(25, 2);
  });

  it("excluye del adeudado facturas con saldo cero o negativo", () => {
    const rows = [
      factura({ saldo: 0 }),
      factura({ id: "n", saldo: -10 }),
      factura({ id: "p", saldo: 100 }),
    ];
    const k = calcularKpisEstadoCuenta(rows);
    expect(k.facturasAdeudadas).toBe(1);
    expect(k.adeudado.mxn).toBeCloseTo(100, 2);
  });
});
