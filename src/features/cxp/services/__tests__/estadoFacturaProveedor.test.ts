/**
 * 13.116.0 — Bordes del cálculo de estado de factura proveedor.
 * Sin estos tests, un cambio sutil (>= vs >, 0.01 vs 0.005) rompe el reporte
 * de CxP sin que nadie se entere hasta el cierre de mes.
 */
import { describe, it, expect } from "vitest";
import { decidirEstadoFactura, SALDO_TOLERANCIA_MXN } from "../estadoFacturaProveedor";

describe("decidirEstadoFactura", () => {
  it("saldo exactamente igual a la tolerancia → Pagada (borde inclusivo)", () => {
    expect(decidirEstadoFactura("Vigente", SALDO_TOLERANCIA_MXN, 99.99)).toBe("Pagada");
  });

  it("saldo 1 centavo arriba de la tolerancia → Vigente", () => {
    expect(decidirEstadoFactura("Vigente", 0.02)).toBe("Vigente");
  });

  it("saldo 0 → Pagada", () => {
    expect(decidirEstadoFactura("Vigente", 0)).toBe("Pagada");
  });

  it("saldo negativo (sobrepago) → Pagada", () => {
    expect(decidirEstadoFactura("Vigente", -5)).toBe("Pagada");
  });

  it("Cancelada NUNCA se mueve aunque saldo sea 0", () => {
    expect(decidirEstadoFactura("Cancelada", 0)).toBe("Cancelada");
  });

  it("Borrador NUNCA se mueve aunque saldo sea 0", () => {
    expect(decidirEstadoFactura("Borrador", 0)).toBe("Borrador");
  });

  it("Pagada con saldo > tolerancia → reabre a Vigente (reversa de pago)", () => {
    expect(decidirEstadoFactura("Pagada", 100)).toBe("Vigente");
  });

  it("saldo NaN → no toca el estado (datos sucios no deben falsear pagos)", () => {
    expect(decidirEstadoFactura("Vigente", NaN)).toBe("Vigente");
  });
});


it.each([0.001, 0.01])("deuda íntegra %s sin cobertura queda vigente y reabre al reversar", (saldo) => {
  expect(decidirEstadoFactura("Vigente", saldo, 0)).toBe("Vigente");
  expect(decidirEstadoFactura("Pagada", saldo, 0)).toBe("Vigente");
});
it.each([0.01, 99.99])("remanente inclusivo con cobertura neta %s conserva Pagada", (cubierto) => {
  expect(decidirEstadoFactura("Vigente", 0.01, cubierto)).toBe("Pagada");
});
it.each([NaN, Infinity, -Infinity])("cobertura no finita %s nunca produce Pagada", (cubierto) => {
  expect(decidirEstadoFactura("Vigente", 0.01, cubierto)).toBe("Vigente");
});
it("cobertura negativa no salda una deuda positiva", () => {
  expect(decidirEstadoFactura("Vigente", 0.01, -1)).toBe("Vigente");
});
