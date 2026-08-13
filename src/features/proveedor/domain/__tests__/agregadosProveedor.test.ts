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

describe("calcularAgregadosProveedor — pagos parciales conciliados (Ola 1)", () => {
  it("usa el monto pagado real en vez del estado legado todo-o-nada", () => {
    const r = calcularAgregadosProveedor(
      [{ monto: 1000, moneda: "MXN", estadoLiquidacion: "Pendiente", montoPagado: 600 }],
      18,
    );
    expect(r.totalFacturado).toBe(1000);
    expect(r.totalPagado).toBe(600);
    expect(r.totalPendiente).toBe(400);
  });

  it("no permite que el pagado exceda lo costeado", () => {
    const r = calcularAgregadosProveedor(
      [{ monto: 500, moneda: "MXN", montoPagado: 900 }],
      18,
    );
    expect(r.totalPagado).toBe(500);
    expect(r.totalPendiente).toBe(0);
  });

  it("ignora montos pagados negativos o inválidos", () => {
    const r = calcularAgregadosProveedor(
      [{ monto: 500, moneda: "MXN", montoPagado: -50 }],
      18,
    );
    expect(r.totalPagado).toBe(0);
  });

  it("mantiene el estado legado cuando no hay monto conciliado", () => {
    const r = calcularAgregadosProveedor(
      [{ monto: 300, moneda: "MXN", estadoLiquidacion: "Pagado" }],
      18,
    );
    expect(r.totalPagado).toBe(300);
  });

  it("convierte el pagado en USD con el tipo de cambio del día", () => {
    const r = calcularAgregadosProveedor(
      [{ monto: 100, moneda: "USD", montoPagado: 25 }],
      18,
    );
    expect(r.totalFacturado).toBe(1800);
    expect(r.totalPagado).toBe(450);
  });
});
