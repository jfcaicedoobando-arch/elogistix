import { describe, expect, it } from "vitest";
import { derivarEstadoPago, tcCuadreExacto, tcManualValido } from "../registrarPagoDerivados";

const base = {
  monto: "17008.32", monedaPago: "MXN", fecha: "2026-09-09", hoy: "2026-10-02",
  monedaFactura: "USD", saldo: 1005, rates: { usdMxn: 16.9202, eurMxn: 19 }, metodoPagoFactura: "PPD",
};

describe("TC convenido en el cobro", () => {
  it("con DOF del día excede el saldo (caso F1058)", () => {
    expect(derivarEstadoPago(base).excede).toBe(true);
  });
  it("el TC de cuadre liquida exacto sin cambiar la fecha", () => {
    const tc = tcCuadreExacto(17008.32, 1005);
    expect(tc).toBe(16.9237);
    const d = derivarEstadoPago({ ...base, tcManual: String(tc) });
    expect(d.montoAplicado).toBeCloseTo(1005, 3);
    expect(d.excede).toBe(false);
    expect(d.tipoCambio).toBe(16.9237);
    expect(d.invalido).toBe(false);
  });
  it("fuera de banda bloquea", () => {
    expect(tcManualValido("2")).toBeNull();
    expect(derivarEstadoPago({ ...base, tcManual: "2" }).tcBloqueado).toBe(true);
  });
  it("el TC manual sustituye al de respaldo", () => {
    const d = derivarEstadoPago({ ...base, rates: { ...base.rates, esFallback: true }, tcManual: "16.9237" });
    expect(d.tcRespaldo).toBe(false);
  });
});
