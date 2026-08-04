import { describe, it, expect } from "vitest";
import { calcularAgregadosProveedor } from "../agregadosProveedor";

describe("proveedor/domain/agregadosProveedor", () => {
  it("suma MXN sin conversión", () => {
    const r = calcularAgregadosProveedor(
      [
        { monto: 1000, moneda: "MXN", estadoLiquidacion: "Pagado" },
        { monto: 500, moneda: "MXN", estadoLiquidacion: "Pendiente" },
      ],
      20,
    );
    expect(r.totalFacturado).toBe(1500);
    expect(r.totalPagado).toBe(1000);
    expect(r.totalPendiente).toBe(500);
    expect(r.monedasSinTc).toEqual([]);
  });

  it("convierte USD con el tipo de cambio y no mezcla divisas", () => {
    const r = calcularAgregadosProveedor(
      [
        { monto: 1000, moneda: "MXN", estadoLiquidacion: "Pendiente" },
        { monto: 100, moneda: "USD", estadoLiquidacion: "Pagado" },
      ],
      20,
    );
    expect(r.totalFacturado).toBe(3000);
    expect(r.totalPagado).toBe(2000);
    expect(r.porMoneda).toEqual({ MXN: 1000, USD: 100 });
  });

  it("reporta monedas sin tipo de cambio confiable", () => {
    const r = calcularAgregadosProveedor(
      [
        { monto: 100, moneda: "USD", estadoLiquidacion: "Pendiente" },
        { monto: 50, moneda: "EUR", estadoLiquidacion: "Pendiente" },
      ],
      0,
    );
    expect(r.totalFacturado).toBe(0);
    expect(r.monedasSinTc.sort()).toEqual(["EUR", "USD"]);
  });

  it("trata moneda ausente como MXN", () => {
    const r = calcularAgregadosProveedor([{ monto: 250 }], 20);
    expect(r.totalFacturado).toBe(250);
    expect(r.porMoneda).toEqual({ MXN: 250 });
  });
});
