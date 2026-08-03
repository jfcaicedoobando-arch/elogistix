/**
 * Edición de pagos a proveedor: el importe del pago original vuelve al saldo
 * antes de validar el nuevo monto (v13.395.0).
 */
import { describe, expect, it } from "vitest";
import {
  facturaSinPagoEditado,
  montoOriginalEnMonedaFactura,
  valoresInicialesEdicion,
  type PagoEditable,
} from "@/features/cxp/hooks/usePagoProveedorForm.editar";
import {
  saldoDisponiblePago,
  validarPagoProveedor,
} from "@/features/cxp/services/pagoProveedorValidaciones";

const pago: PagoEditable = {
  id: "p1",
  fecha_pago: "2026-02-10",
  monto: 500,
  moneda: "MXN",
  tipo_cambio_usd: null,
  metodo_pago: "Transferencia",
  referencia: "REF-1",
  notas: "",
  cuenta_bancaria_id: "c1",
  diferencia_cambiaria_mxn: null,
};

const factura = {
  moneda: "MXN" as const,
  saldo: 200,
  total: 1000,
  subtotal: 862.07,
  iva: 137.93,
  ieps: 0,
  retenciones: 0,
  fecha_emision: "2026-02-01",
  estado_aprobacion: "aprobada" as const,
};

const base = {
  factura,
  fecha: "2026-02-12",
  hoy: "2026-02-15",
  montoTexto: "600.00",
  monto: 600,
  montoEnMonedaFactura: 600,
  moneda: "MXN" as const,
  tcNum: null,
  bloqueadoPorTc: false,
  requiereCuenta: false,
  cuenta: null,
  diffMxnTexto: "",
  esUsdPagadoEnMxn: false,
};

describe("montoOriginalEnMonedaFactura", () => {
  it("devuelve 0 sin pago", () => {
    expect(montoOriginalEnMonedaFactura(null, "MXN")).toBe(0);
  });

  it("usa el monto tal cual con misma moneda", () => {
    expect(montoOriginalEnMonedaFactura(pago, "MXN")).toBe(500);
  });

  it("convierte un pago MXN de una factura USD con su TC", () => {
    const p = { ...pago, tipo_cambio_usd: 20 };
    expect(montoOriginalEnMonedaFactura(p, "USD")).toBe(25);
  });
});

describe("facturaSinPagoEditado", () => {
  it("regresa el importe al saldo sin exceder el total", () => {
    const r = facturaSinPagoEditado({ saldo: 200, pagado: 800, total: 1000 }, 500);
    expect(r).toEqual({ saldo: 700, pagado: 300 });
  });

  it("nunca deja pagado negativo ni saldo mayor al total", () => {
    const r = facturaSinPagoEditado({ saldo: 900, pagado: 100, total: 1000 }, 500);
    expect(r).toEqual({ saldo: 1000, pagado: 0 });
  });
});

describe("saldoDisponiblePago", () => {
  it("en modo crear usa el saldo real", () => {
    expect(saldoDisponiblePago({ ...base, modo: "crear" })).toBe(200);
  });

  it("en modo editar suma el monto original", () => {
    expect(
      saldoDisponiblePago({ ...base, modo: "editar", montoOriginalEnMonedaFactura: 500 }),
    ).toBe(700);
  });
});

describe("validarPagoProveedor al editar", () => {
  it("rechaza 600 al crear porque excede el saldo de 200", () => {
    expect(validarPagoProveedor(base).error).toMatch(/excede el saldo/);
  });

  it("acepta 600 al editar un pago de 500 (saldo disponible 700)", () => {
    const r = validarPagoProveedor({
      ...base,
      modo: "editar",
      montoOriginalEnMonedaFactura: 500,
    });
    expect(r.error).toBeNull();
  });

  it("rechaza al editar si supera el saldo disponible recalculado", () => {
    const r = validarPagoProveedor({
      ...base,
      montoTexto: "750.00",
      monto: 750,
      montoEnMonedaFactura: 750,
      modo: "editar",
      montoOriginalEnMonedaFactura: 500,
    });
    expect(r.error).toMatch(/excede el saldo/);
  });

  it("mantiene las validaciones de decimales y fecha al editar", () => {
    const conDecimales = validarPagoProveedor({
      ...base,
      montoTexto: "600.123",
      modo: "editar",
      montoOriginalEnMonedaFactura: 500,
    });
    expect(conDecimales.error).not.toBeNull();

    const futura = validarPagoProveedor({
      ...base,
      fecha: "2026-03-01",
      modo: "editar",
      montoOriginalEnMonedaFactura: 500,
    });
    expect(futura.error).not.toBeNull();
  });
});

describe("valoresInicialesEdicion", () => {
  it("precarga el formulario con los datos del pago", () => {
    expect(valoresInicialesEdicion(pago)).toEqual({
      fecha: "2026-02-10",
      monto: "500.00",
      moneda: "MXN",
      tc: "",
      metodo: "Transferencia",
      referencia: "REF-1",
      notas: "",
      cuentaId: "c1",
      diffMxn: "",
    });
  });
});
