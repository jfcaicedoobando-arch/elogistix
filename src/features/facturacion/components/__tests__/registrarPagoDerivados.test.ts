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
  it("misma moneda USD conserva valuación MXN y aplicación neutral", () => {
    expect(tcParaPago("USD", "USD", RATES)).toBe(17.06);
    expect(aplicarTcPago(1, "USD", "USD", 17.06)).toBe(1);
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
    formaPago: "03",
  };

  it.each([
    { monto: "1.16", residual: 0, incompleto: false },
    { monto: "1.15", residual: 0.01, incompleto: false },
    { monto: "1.14", residual: 0.02, incompleto: true },
    { monto: "1.12", residual: 0.04, incompleto: true },
    { monto: "1.11", residual: 0.05, incompleto: true },
  ])("AUD54: PUE con residual $residual respeta el cierre de 0.01", ({ monto, residual, incompleto }) => {
    const d = derivarEstadoPago({ ...base, monto, monedaPago: "MXN", monedaFactura: "MXN", saldo: 1.16, metodoPagoFactura: "PUE" });
    expect(d.montoAplicado).toBe(Number(monto));
    expect(1.16 - d.montoAplicado).toBeCloseTo(residual, 4);
    expect(d.pueIncompleto).toBe(incompleto);
    expect(d.invalido).toBe(incompleto);
  });

  it.each([
    { monto: "23", aplicado: 1.15, incompleto: false },
    { monto: "22.99", aplicado: 1.1495, incompleto: true },
  ])("AUD54: PUE cross-moneda valida saldo exacto sin redondear a centavos ($monto)", ({ monto, aplicado, incompleto }) => {
    const d = derivarEstadoPago({ ...base, monto, monedaPago: "MXN", monedaFactura: "USD", saldo: 1.16, metodoPagoFactura: "PUE", tcManual: "20" });
    expect(d.montoAplicado).toBe(aplicado);
    expect(d.pueIncompleto).toBe(incompleto);
    expect(d.invalido).toBe(incompleto);
  });

  it("AUD54: PPD sigue admitiendo un abono parcial", () => {
    const d = derivarEstadoPago({ ...base, monto: "1.12", monedaPago: "MXN", monedaFactura: "MXN", saldo: 1.16, metodoPagoFactura: "PPD" });
    expect(d.pueIncompleto).toBe(false);
    expect(d.invalido).toBe(false);
  });

  it("AUD54: la tolerancia de cierre PUE no amplía la de sobrepago", () => {
    const d = derivarEstadoPago({ ...base, monto: "1.17", monedaPago: "MXN", monedaFactura: "MXN", saldo: 1.16, metodoPagoFactura: "PUE" });
    expect(d.pueIncompleto).toBe(false);
    expect(d.excede).toBe(true);
    expect(d.invalido).toBe(true);
  });

  it.each([
    { monto: "57.99", incompleto: false },
    { monto: "57.98", incompleto: true },
  ])("AUD54: límite de cierre sobre saldo neto de NC ($monto)", ({ monto, incompleto }) => {
    const d = derivarEstadoPago({ ...base, monto, monedaPago: "MXN", monedaFactura: "MXN", saldo: 58, metodoPagoFactura: "PUE" });
    expect(d.montoAplicado).toBe(Number(monto));
    expect(d.invalido).toBe(incompleto);
  });

  it.each([{ monto: "58", incompleto: false }, { monto: "57", incompleto: true }])("AUD25: PUE total116/NC58 liquida saldo canónico58 con $monto", ({ monto, incompleto }) => {
    // `saldo_factura` entrega58 después de una NC efectiva58 sobre total116.
    // El formulario valida ese saldo RPC, que no se sustituye por el total bruto.
    const d = derivarEstadoPago({ ...base, monto, monedaPago: "MXN", monedaFactura: "MXN", saldo: 58, metodoPagoFactura: "PUE" });
    expect(d.montoAplicado).toBe(Number(monto));
    expect(d.excede).toBe(false);
    expect(d.pueIncompleto).toBe(incompleto);
    expect(d.invalido).toBe(incompleto);
  });

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

describe("AUD88/91: preflight de cobros reales", () => {
  const pago = { monto: "1", monedaPago: "USD", monedaFactura: "USD", saldo: 116,
    fecha: "2026-10-04", hoy: "2026-10-05", rates: { usdMxn: 18.1903, eurMxn: 20 },
    metodoPagoFactura: "PPD", formaPago: "03" };
  it.each(["99", "", "77"])("bloquea %s antes del submit", (formaPago) => {
    expect(derivarEstadoPago({ ...pago, formaPago })).toMatchObject({ formaPagoInvalida: true, invalido: true });
  });
  it("USD 1 sobre USD aplica 1 y valúa 18.1903 MXN", () => {
    expect(derivarEstadoPago(pago)).toMatchObject({ montoAplicado: 1, tipoCambio: 18.1903, invalido: false });
  });
  it("EUR misma moneda conserva saldo y TC manual a MXN independiente", () => {
    expect(derivarEstadoPago({ ...pago, monedaPago: "EUR", monedaFactura: "EUR", tcManual: "21" }))
      .toMatchObject({ montoAplicado: 1, tipoCambio: 21, invalido: false });
  });
  it("MXN sobre MXN sigue usando uno sin DOF", () => {
    expect(derivarEstadoPago({ ...pago, monedaPago: "MXN", monedaFactura: "MXN", rates: undefined }))
      .toMatchObject({ montoAplicado: 1, tipoCambio: 1, invalido: false });
  });
  it.each([undefined, { usdMxn: 1, eurMxn: 1 }, { usdMxn: 18.1903, eurMxn: 20, esFallback: true }])("bloquea USD misma moneda sin valuación confiable: %o", (rates) => {
      expect(derivarEstadoPago({ ...pago, rates })).toMatchObject({ tcBloqueado: true, invalido: true });
    });
  it("TC capturado sustituye fallback para la misma divisa", () => {
    expect(derivarEstadoPago({ ...pago, rates: undefined, tcManual: "18.1903" })).toMatchObject({ tipoCambio: 18.1903, invalido: false });
  });
  it("AUD92: MXN20 a TC20 conserva aplicadoUSD1", () => {
    expect(derivarEstadoPago({ ...pago, monto: "20", monedaPago: "MXN", tcManual: "20" }))
      .toMatchObject({ montoNum: 20, montoAplicado: 1, tipoCambio: 20, invalido: false });
  });
});
