/**
 * 13.116.0 — Bordes del cálculo de estado de factura proveedor.
 * Sin estos tests, un cambio sutil (>= vs >, 0.01 vs 0.005) rompe el reporte
 * de CxP sin que nadie se entere hasta el cierre de mes.
 */
import { describe, it, expect } from "vitest";
import { decidirEstadoFactura, SALDO_TOLERANCIA_MXN } from "../estadoFacturaProveedor";

describe("decidirEstadoFactura", () => {
  it("saldo exactamente igual a la tolerancia → Pagada (borde inclusivo)", () => {
    expect(decidirEstadoFactura("Vigente", SALDO_TOLERANCIA_MXN)).toBe("Pagada");
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
