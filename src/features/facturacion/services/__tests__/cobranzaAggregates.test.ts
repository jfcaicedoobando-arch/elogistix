import { describe, it, expect, vi } from "vitest";
import {
  agruparSaldosPorMoneda,
  calcularKPIs,
} from "@/features/facturacion/services/cobranzaAggregates";
import type { FacturaCobranza } from "@/features/facturacion/services/cobranza";

function f(overrides: Partial<FacturaCobranza>): FacturaCobranza {
  return {
    id: "f1",
    numero: "F",
    cliente_id: "c1",
    cliente_nombre: "ACME",
    expediente: "EXP",
    moneda: "MXN",
    total: 100,
    pagado: 0,
    notas_credito_aplicadas: 0,
    saldo: 100,
    fecha_emision: "2026-01-01",
    fecha_vencimiento: "2026-02-01",
    dias_vencido: 0,
    estatus_cobranza: "Vigente",
    estado_factura: "Emitida",
    tipo_cambio: 1,
    ...overrides,
  };
}

describe("agruparSaldosPorMoneda", () => {
  it("agrupa MXN y USD por separado", () => {
    const r = agruparSaldosPorMoneda([
      f({ moneda: "MXN", saldo: 100 }),
      f({ moneda: "USD", saldo: 50 }),
      f({ moneda: "MXN", saldo: 200 }),
    ]);
    expect(r.saldoPendienteMXN).toBe(300);
    expect(r.saldoPendienteUSD).toBe(50);
  });

  it("ignora filas con saldo <= 0", () => {
    const r = agruparSaldosPorMoneda([
      f({ moneda: "MXN", saldo: 0 }),
      f({ moneda: "MXN", saldo: -10 }),
      f({ moneda: "MXN", saldo: 50 }),
    ]);
    expect(r.saldoPendienteMXN).toBe(50);
  });

  it("registra otras monedas en porMoneda sin contaminar buckets", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = agruparSaldosPorMoneda([
      f({ moneda: "EUR" as never, saldo: 80 }),
      f({ moneda: "MXN", saldo: 100 }),
    ]);
    expect(r.porMoneda.EUR).toBe(80);
    expect(r.saldoPendienteMXN).toBe(100);
    expect(r.descartadas).toBe(1);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("sin filas devuelve ceros", () => {
    const r = agruparSaldosPorMoneda([]);
    expect(r.saldoPendienteMXN).toBe(0);
    expect(r.saldoPendienteUSD).toBe(0);
    expect(r.descartadas).toBe(0);
    expect(r.porMoneda).toEqual({});
  });
});

describe("calcularKPIs", () => {
  it("suma vencido MXN/USD por separado", () => {
    const r = calcularKPIs([
      f({ moneda: "MXN", saldo: 100, estatus_cobranza: "Vencida", dias_vencido: 10 }),
      f({ moneda: "USD", saldo: 50, estatus_cobranza: "Vencida", dias_vencido: 5 }),
      f({ moneda: "MXN", saldo: 30, estatus_cobranza: "Vencida", dias_vencido: 2 }),
    ]);
    expect(r.vencido_mxn).toBe(130);
    expect(r.vencido_usd).toBe(50);
    expect(r.facturas_vencidas).toBe(3);
  });

  it("por_vencer cuenta dias entre -7 y 0", () => {
    const r = calcularKPIs([
      f({ moneda: "MXN", saldo: 10, dias_vencido: -3 }),
      f({ moneda: "MXN", saldo: 20, dias_vencido: -8 }),
      f({ moneda: "USD", saldo: 5, dias_vencido: -1 }),
    ]);
    expect(r.por_vencer_7d_mxn).toBe(10);
    expect(r.por_vencer_7d_usd).toBe(5);
  });

  it("ignora monedas no canónicas en KPIs", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = calcularKPIs([
      f({ moneda: "EUR" as never, saldo: 99, estatus_cobranza: "Vencida", dias_vencido: 5 }),
    ]);
    expect(r.vencido_mxn).toBe(0);
    expect(r.vencido_usd).toBe(0);
    expect(r.facturas_vencidas).toBe(0);
  });

  it("totales reflejan agrupación de saldos pendientes", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    const r = calcularKPIs([
      f({ moneda: "MXN", saldo: 100 }),
      f({ moneda: "USD", saldo: 50 }),
    ]);
    expect(r.total_mxn).toBe(100);
    expect(r.total_usd).toBe(50);
  });

  it("array vacío devuelve todos los KPIs en cero", () => {
    const r = calcularKPIs([]);
    expect(r).toEqual({
      total_mxn: 0,
      total_usd: 0,
      vencido_mxn: 0,
      vencido_usd: 0,
      por_vencer_7d_mxn: 0,
      por_vencer_7d_usd: 0,
      facturas_vencidas: 0,
    });
  });

  it("salta filas con saldo <= 0 en cálculo de vencidos", () => {
    const r = calcularKPIs([
      f({ moneda: "MXN", saldo: 0, estatus_cobranza: "Vencida" }),
      f({ moneda: "MXN", saldo: 50, estatus_cobranza: "Vencida" }),
    ]);
    expect(r.facturas_vencidas).toBe(1);
    expect(r.vencido_mxn).toBe(50);
  });

  it("dias_vencido > 0 no cae en por_vencer", () => {
    const r = calcularKPIs([
      f({ moneda: "MXN", saldo: 100, dias_vencido: 3 }),
    ]);
    expect(r.por_vencer_7d_mxn).toBe(0);
  });
});
