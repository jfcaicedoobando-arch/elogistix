import { describe, it, expect, vi, afterEach } from "vitest";
import {
  agruparSaldosPorMoneda,
  calcularKPIs,
  type FacturaCobranza,
} from "@/features/facturacion/services/cobranza";

const f = (over: Partial<FacturaCobranza> = {}): FacturaCobranza => ({
  id: "1",
  numero: "F-1",
  cliente_id: "c1",
  cliente_nombre: "ACME",
  expediente: "EXP-1",
  moneda: "MXN",
  total: 1000,
  pagado: 0,
  notas_credito_aplicadas: 0,
  saldo: 1000,
  fecha_emision: "2026-05-01",
  fecha_vencimiento: "2026-05-30",
  dias_vencido: 0,
  estatus_cobranza: "Vigente",
  estado_factura: "Emitida",
  tipo_cambio: 1,
  ...over,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("agruparSaldosPorMoneda (cobranza — separación de monedas)", () => {
  it("separa MXN y USD sin mezclar", () => {
    const r = agruparSaldosPorMoneda([
      f({ moneda: "MXN", saldo: 100 }),
      f({ moneda: "USD", saldo: 50 }),
      f({ moneda: "MXN", saldo: 200 }),
    ]);
    expect(r.saldoPendienteMXN).toBe(300);
    expect(r.saldoPendienteUSD).toBe(50);
    expect(r.descartadas).toBe(0);
  });

  it("ignora saldos <= 0", () => {
    const r = agruparSaldosPorMoneda([
      f({ moneda: "MXN", saldo: 0 }),
      f({ moneda: "USD", saldo: -10 }),
      f({ moneda: "MXN", saldo: 100 }),
    ]);
    expect(r.saldoPendienteMXN).toBe(100);
    expect(r.saldoPendienteUSD).toBe(0);
  });

  it("descarta monedas ajenas sin contaminar buckets canónicos", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = agruparSaldosPorMoneda([
      f({ moneda: "MXN", saldo: 100 }),
      f({ moneda: "EUR" as unknown as FacturaCobranza["moneda"], saldo: 999 }),
    ]);
    expect(r.saldoPendienteMXN).toBe(100);
    expect(r.saldoPendienteUSD).toBe(0);
    expect(r.descartadas).toBe(1);
    expect(r.porMoneda.EUR).toBe(999);
    expect(warn).toHaveBeenCalled();
  });

  it("precisión: 0.1 + 0.1 + 0.1 === 0.3 (vía currency.js)", () => {
    const r = agruparSaldosPorMoneda([
      f({ moneda: "MXN", saldo: 0.1 }),
      f({ moneda: "MXN", saldo: 0.1 }),
      f({ moneda: "MXN", saldo: 0.1 }),
    ]);
    expect(r.saldoPendienteMXN).toBe(0.3);
  });
});

describe("calcularKPIs (cobranza — consistencia con agruparSaldosPorMoneda)", () => {
  it("totales coinciden con agruparSaldosPorMoneda", () => {
    const filas = [
      f({ moneda: "MXN", saldo: 100 }),
      f({ moneda: "USD", saldo: 50 }),
      f({ moneda: "MXN", saldo: 200 }),
    ];
    const k = calcularKPIs(filas);
    const a = agruparSaldosPorMoneda(filas);
    expect(k.total_mxn).toBe(a.saldoPendienteMXN);
    expect(k.total_usd).toBe(a.saldoPendienteUSD);
  });

  it("vencido y por_vencer_7d se separan por moneda", () => {
    const filas = [
      f({ moneda: "MXN", saldo: 100, estatus_cobranza: "Vencida", dias_vencido: 10 }),
      f({ moneda: "USD", saldo: 50, estatus_cobranza: "Vencida", dias_vencido: 5 }),
      f({ moneda: "MXN", saldo: 30, estatus_cobranza: "Por vencer", dias_vencido: -2 }),
      f({ moneda: "USD", saldo: 20, estatus_cobranza: "Por vencer", dias_vencido: -3 }),
    ];
    const k = calcularKPIs(filas);
    expect(k.vencido_mxn).toBe(100);
    expect(k.vencido_usd).toBe(50);
    expect(k.por_vencer_7d_mxn).toBe(30);
    expect(k.por_vencer_7d_usd).toBe(20);
    expect(k.facturas_vencidas).toBe(2);
  });

  it("excluye monedas ajenas de los KPIs canónicos", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const k = calcularKPIs([
      f({ moneda: "MXN", saldo: 100 }),
      f({ moneda: "EUR" as unknown as FacturaCobranza["moneda"], saldo: 9999, estatus_cobranza: "Vencida", dias_vencido: 30 }),
    ]);
    expect(k.total_mxn).toBe(100);
    expect(k.total_usd).toBe(0);
    expect(k.vencido_mxn).toBe(0);
    expect(k.vencido_usd).toBe(0);
    expect(k.facturas_vencidas).toBe(0);
    expect(warn).toHaveBeenCalled();
  });
});
