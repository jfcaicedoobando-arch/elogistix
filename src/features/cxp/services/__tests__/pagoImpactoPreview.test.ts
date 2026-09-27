import { describe, it, expect } from "vitest";
import { calcularImpactoPago } from "../pagoImpactoPreview";

const facturaBase = { moneda: "MXN", saldo: 1000, pagado: 0, total: 1000 };

function build(over: Partial<Parameters<typeof calcularImpactoPago>[0]> = {}) {
  return calcularImpactoPago({
    factura: facturaBase,
    montoEnMonedaFactura: 400,
    monto: 400,
    monedaPago: "MXN",
    tcNum: null,
    bloqueadoPorTc: false,
    requiereCuenta: true,
    cuentaEtiqueta: "BBVA · Operativa (MXN)",
    proveedor: { saldoTotal: 2500, facturasAbiertas: 3 },
    ...over,
  });
}

describe("calcularImpactoPago", () => {
  it("devuelve null sin factura", () => {
    expect(build({ factura: null })).toBeNull();
  });

  it("calcula pago parcial de factura y proveedor", () => {
    const r = build()!;
    expect(r.factura.saldoDespues).toBe(600);
    expect(r.factura.pagadoDespues).toBe(400);
    expect(r.factura.estadoDespues).toBe("Parcialmente pagada");
    expect(r.factura.liquidaFactura).toBe(false);
    expect(r.proveedor?.saldoDespues).toBe(2100);
    expect(r.proveedor?.facturasAbiertasDespues).toBe(3);
  });

  it("marca la factura como pagada al liquidar el saldo", () => {
    const r = build({ montoEnMonedaFactura: 1000, monto: 1000 })!;
    expect(r.factura.saldoDespues).toBe(0);
    expect(r.factura.estadoDespues).toBe("Pagada");
    expect(r.factura.liquidaFactura).toBe(true);
    expect(r.proveedor?.facturasAbiertasDespues).toBe(2);
  });

  it("detecta exceso sobre el saldo sin dejar saldos negativos", () => {
    const r = build({ montoEnMonedaFactura: 1500, monto: 1500 })!;
    expect(r.factura.excede).toBe(true);
    expect(r.factura.saldoDespues).toBe(0);
    expect(r.proveedor?.saldoDespues).toBe(1500);
  });

  it("no aplica el pago cuando falta el tipo de cambio", () => {
    const r = build({ bloqueadoPorTc: true })!;
    expect(r.aplicable).toBe(false);
    expect(r.factura.saldoDespues).toBe(1000);
    expect(r.salida).toMatchObject({ tipo: "banco", montoMxn: 400 });
  });

  it("convierte la salida de banco a MXN con el TC capturado", () => {
    const r = build({
      factura: { moneda: "USD", saldo: 100, pagado: 0, total: 100 },
      montoEnMonedaFactura: 50,
      monto: 50,
      monedaPago: "USD",
      tcNum: 18.5,
      proveedor: { saldoTotal: 300, facturasAbiertas: 2 },
    })!;
    expect(r.salida).toMatchObject({ tipo: "banco", montoMxn: 925 });
    expect(r.factura.saldoDespues).toBe(50);
  });

  it("omite el bloque de proveedor cuando no hay datos", () => {
    expect(build({ proveedor: null })!.proveedor).toBeNull();
  });

  it("efectivo aplica a la deuda sin describir una salida bancaria, aun con cuenta residual", () => {
    const r = build({ requiereCuenta: false })!;
    expect(r.salida).toEqual({ tipo: "efectivo", moneda: "MXN", monto: 400 });
    expect(r.factura.saldoDespues).toBe(600);
    expect(r.proveedor?.saldoDespues).toBe(2100);
  });

  it("conserva la moneda capturada en efectivo cuando la deuda está en otra moneda", () => {
    const r = build({ requiereCuenta: false, monedaPago: "USD", monto: 20, tcNum: 20 })!;
    expect(r.salida).toEqual({ tipo: "efectivo", moneda: "USD", monto: 20 });
    expect(r.factura.saldoDespues).toBe(600);
  });

  it("una transferencia sin cuenta sigue siendo bancaria; no se confunde con efectivo", () => {
    expect(build({ cuentaEtiqueta: null })!.salida).toMatchObject({ tipo: "banco", cuentaEtiqueta: null });
  });
});
