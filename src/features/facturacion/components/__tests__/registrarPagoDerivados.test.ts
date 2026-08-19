/**
 * Convención de `pagos_factura.tipo_cambio`: pesos por unidad de divisa,
 * igual que `public.convertir_monto_pago_a_factura`. Antes la UI mandaba la
 * razón pago→factura (0.0586 USD/MXN) y el trigger de la BD dividía entre
 * ella, inflando el monto aplicado (~×291) y reventando el timbrado del REP.
 */
import { describe, it, expect } from "vitest";
import {
  aplicarTcPago,
  tcParaPago,
  derivarEstadoPago,
} from "../registrarPagoDerivados";

const RATES = { usdMxn: 17.06, eurMxn: 19.75 };

describe("tcParaPago", () => {
  it("misma moneda → 1", () => {
    expect(tcParaPago("USD", "USD", RATES)).toBe(1);
  });

  it("pago MXN de factura USD usa pesos por dólar (no la razón invertida)", () => {
    expect(tcParaPago("MXN", "USD", RATES)).toBe(17.06);
  });

  it("pago USD de factura MXN usa el mismo TC", () => {
    expect(tcParaPago("USD", "MXN", RATES)).toBe(17.06);
  });

  it("cruce USD↔EUR no está soportado por la BD", () => {
    expect(tcParaPago("USD", "EUR", RATES)).toBeNull();
  });

  it("sin tasas confiables devuelve null", () => {
    expect(tcParaPago("MXN", "USD", undefined)).toBeNull();
  });
});

describe("aplicarTcPago", () => {
  it("pago en pesos de factura en dólares divide", () => {
    expect(aplicarTcPago(23141.03, "MXN", "USD", 17.06)).toBeCloseTo(1356.4496, 4);
  });

  it("pago en dólares de factura en pesos multiplica", () => {
    expect(aplicarTcPago(1000, "USD", "MXN", 17.06)).toBeCloseTo(17060, 4);
  });

  it("sin TC no simula paridad 1:1", () => {
    expect(aplicarTcPago(1000, "MXN", "USD", null)).toBe(0);
  });
});

describe("derivarEstadoPago (cross-moneda)", () => {
  const base = {
    fecha: "2026-08-14",
    hoy: "2026-08-19",
    fechaEmision: "2026-08-01",
    rates: RATES,
  };

  it("no marca sobrepago cuando el pago en pesos salda la factura en USD", () => {
    const d = derivarEstadoPago({
      ...base,
      monto: "23141.03",
      monedaPago: "MXN",
      monedaFactura: "USD",
      saldo: 1356.45,
    });
    expect(d.tipoCambio).toBe(17.06);
    expect(d.montoAplicado).toBeCloseTo(1356.4496, 4);
    expect(d.excede).toBe(false);
    expect(d.invalido).toBe(false);
  });

  it("bloquea el cruce USD↔EUR", () => {
    const d = derivarEstadoPago({
      ...base,
      monto: "100",
      monedaPago: "EUR",
      monedaFactura: "USD",
      saldo: 1000,
    });
    expect(d.cruceNoSoportado).toBe(true);
    expect(d.tcBloqueado).toBe(true);
    expect(d.invalido).toBe(true);
  });
});
