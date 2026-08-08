import { describe, it, expect } from "vitest";
import {
  refPagoDeLibro,
  refPagoDeMovimiento,
  resumenAplicaciones,
  rutaAplicacion,
  saldoAplicacion,
  totalAplicado,
  type AplicacionPago,
} from "@/features/tesoreria/domain/pagoDetalle";

function aplicacion(over: Partial<AplicacionPago> = {}): AplicacionPago {
  return {
    documento_id: "f1",
    documento_tipo: "proveedor",
    folio: "FP-000123",
    folio_proveedor: "A-99",
    embarque_id: null,
    moneda: "USD",
    monto_aplicado: 100,
    total: 250,
    pagado: 100,
    fecha_aplicacion: null,
    pago_id: "p1",
    ...over,
  };
}

describe("refPagoDeMovimiento", () => {
  it("prioriza el lote sobre el pago individual", () => {
    expect(
      refPagoDeMovimiento({ pago_proveedor_id: "pp", pago_proveedor_lote_id: "lote" }),
    ).toEqual({ tipo: "lote", id: "lote" });
  });

  it("reconoce cobros, pagos y anticipos", () => {
    expect(refPagoDeMovimiento({ pago_factura_id: "pf" })).toEqual({ tipo: "cobro", id: "pf" });
    expect(refPagoDeMovimiento({ pago_proveedor_id: "pp" })).toEqual({ tipo: "pago", id: "pp" });
    expect(refPagoDeMovimiento({ anticipo_proveedor_id: "an" })).toEqual({
      tipo: "anticipo",
      id: "an",
    });
  });

  it("devuelve null cuando el movimiento no tiene vínculo", () => {
    expect(refPagoDeMovimiento(null)).toBeNull();
    expect(refPagoDeMovimiento({})).toBeNull();
  });
});

describe("refPagoDeLibro", () => {
  it("abre como lote un pago que pertenece a un lote", () => {
    expect(refPagoDeLibro({ tipo: "pago", id: "pp", lote_id: "lote" })).toEqual({
      tipo: "lote",
      id: "lote",
    });
  });

  it("respeta el tipo original cuando no hay lote", () => {
    expect(refPagoDeLibro({ tipo: "cobro", id: "pf", lote_id: null })).toEqual({
      tipo: "cobro",
      id: "pf",
    });
  });
});

describe("cálculos de aplicaciones", () => {
  it("suma lo aplicado", () => {
    expect(totalAplicado([aplicacion(), aplicacion({ monto_aplicado: 50 })])).toBe(150);
  });

  it("calcula el saldo sin permitir negativos", () => {
    expect(saldoAplicacion(aplicacion())).toBe(150);
    expect(saldoAplicacion(aplicacion({ pagado: 400 }))).toBe(0);
  });

  it("resume la lista de facturas", () => {
    expect(resumenAplicaciones([])).toBe("Sin aplicar");
    expect(resumenAplicaciones([aplicacion()])).toBe("FP-000123");
    expect(resumenAplicaciones([aplicacion(), aplicacion({ documento_id: "f2" })])).toBe(
      "2 facturas",
    );
  });

  it("apunta a la ruta correcta según el tipo de documento", () => {
    expect(rutaAplicacion(aplicacion())).toBe("/compras/facturas/f1");
    expect(rutaAplicacion(aplicacion({ documento_tipo: "cliente" }))).toBe("/facturacion/f1");
  });
});
