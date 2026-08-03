import { describe, it, expect } from "vitest";
import {
  validarPagoProveedor,
  descuadreTotalesFactura,
  tieneMasDeDosDecimales,
  calcularAvisosPago,
  type ValidarPagoInput,
} from "../pagoProveedorValidaciones";

const factura = {
  moneda: "MXN",
  saldo: 1000,
  total: 1160,
  subtotal: 1000,
  iva: 160,
  ieps: 0,
  retenciones: 0,
  fecha_emision: "2026-01-10",
  estado_aprobacion: "aprobada" as const,
};

function base(over: Partial<ValidarPagoInput> = {}): ValidarPagoInput {
  return {
    factura,
    fecha: "2026-01-15",
    hoy: "2026-01-20",
    montoTexto: "500",
    monto: 500,
    montoEnMonedaFactura: 500,
    moneda: "MXN",
    tcNum: null,
    bloqueadoPorTc: false,
    requiereCuenta: true,
    cuenta: { id: "c1", moneda: "MXN" },
    diffMxnTexto: "",
    esUsdPagadoEnMxn: false,
    ...over,
  };
}

describe("pagoProveedorValidaciones", () => {
  it("acepta un pago coherente", () => {
    expect(validarPagoProveedor(base())).toEqual({ error: null, avisos: [] });
  });

  it("rechaza monto cero o negativo", () => {
    expect(validarPagoProveedor(base({ monto: 0, montoTexto: "0" })).error).toMatch(/mayor a 0/);
  });

  it("rechaza más de dos decimales", () => {
    expect(tieneMasDeDosDecimales("10.123")).toBe(true);
    expect(tieneMasDeDosDecimales("10.120")).toBe(false);
    expect(validarPagoProveedor(base({ montoTexto: "500.123" })).error).toMatch(/2 decimales/);
  });

  it("rechaza fecha futura y anterior a la emisión", () => {
    expect(validarPagoProveedor(base({ fecha: "2026-02-01" })).error).toMatch(/futura/);
    expect(validarPagoProveedor(base({ fecha: "2026-01-01" })).error).toMatch(/anterior/);
  });

  it("rechaza monto que excede el saldo", () => {
    expect(
      validarPagoProveedor(base({ monto: 2000, montoTexto: "2000", montoEnMonedaFactura: 2000 })).error,
    ).toMatch(/excede el saldo/);
  });

  it("rechaza cuenta en otra moneda y cuenta faltante", () => {
    expect(validarPagoProveedor(base({ cuenta: { id: "c2", moneda: "USD" } })).error).toMatch(/USD/);
    expect(validarPagoProveedor(base({ cuenta: null })).error).toMatch(/cuenta bancaria/);
  });

  it("valida el tipo de cambio", () => {
    expect(validarPagoProveedor(base({ bloqueadoPorTc: true })).error).toMatch(/tipo de cambio/);
    expect(validarPagoProveedor(base({ tcNum: 99999 })).error).toMatch(/tipo de cambio/);
  });

  it("valida la diferencia cambiaria", () => {
    const a = base({ esUsdPagadoEnMxn: true, tcNum: 18, diffMxnTexto: "9999" });
    expect(validarPagoProveedor(a).error).toMatch(/diferencia cambiaria/);
  });

  it("bloquea facturas no aprobadas o sin saldo", () => {
    expect(
      validarPagoProveedor(base({ factura: { ...factura, estado_aprobacion: "pendiente" } })).error,
    ).toMatch(/aprobada/);
    expect(validarPagoProveedor(base({ factura: { ...factura, saldo: 0 } })).error).toMatch(/saldo/);
  });

  it("detecta descuadre de totales e IVA fuera de tasa", () => {
    const mala = { ...factura, iva: 100 };
    expect(descuadreTotalesFactura(mala)).not.toBe(0);
    const avisos = calcularAvisosPago(base({ factura: mala }));
    expect(avisos.length).toBeGreaterThanOrEqual(2);
    expect(avisos.join(" ")).toMatch(/no cuadran/);
  });

  it("avisa cuando las retenciones superan el subtotal", () => {
    const mala = { ...factura, retenciones: 2000, total: 1000 - 2000 + 160 };
    expect(calcularAvisosPago(base({ factura: mala })).join(" ")).toMatch(/retenciones/);
  });
});
