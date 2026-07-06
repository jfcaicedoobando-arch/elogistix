/**
 * Tests del traductor de errores para pagos a proveedor.
 */
import { describe, it, expect } from "vitest";
import { traducirErrorPagoProveedor } from "../pagosProveedorErrors";

describe("traducirErrorPagoProveedor", () => {
  it("traduce RLS (42501) al mensaje en español", () => {
    expect(
      traducirErrorPagoProveedor({ code: "42501", message: "new row violates row-level security policy" }),
    ).toMatch(/permiso/i);
  });

  it("traduce ORG_MISMATCH", () => {
    expect(traducirErrorPagoProveedor({ code: "ORG_MISMATCH", message: "ORG_MISMATCH" })).toMatch(/organización/i);
  });

  it("traduce FK (23503) y unique (23505)", () => {
    expect(traducirErrorPagoProveedor({ code: "23503", message: "fk" })).toMatch(/falta información/i);
    expect(traducirErrorPagoProveedor({ code: "23505", message: "dup" })).toMatch(/duplicado/i);
  });

  it("traduce check_violation con mensaje 'aprobada'", () => {
    expect(
      traducirErrorPagoProveedor({ code: "23514", message: "La factura debe estar aprobada para registrar pagos" }),
    ).toMatch(/aprobada/i);
  });

  it("traduce embarque cerrado", () => {
    expect(traducirErrorPagoProveedor({ message: "El embarque está cerrado" })).toMatch(/cerrado/i);
  });

  it("traduce SOBREPAGO_PROVEEDOR (trigger BD · Ola A · A3)", () => {
    // El trigger `check_no_sobrepago_proveedor` emite el código en el mensaje.
    expect(
      traducirErrorPagoProveedor({ message: "SOBREPAGO_PROVEEDOR: monto excede el saldo pendiente" }),
    ).toMatch(/excede el saldo pendiente/i);
    // Variante en español que también emite el trigger.
    expect(
      traducirErrorPagoProveedor({ message: "el pago excede el saldo pendiente de la factura" }),
    ).toMatch(/excede el saldo pendiente/i);
  });

  it("fallback genérico cuando no hay info", () => {
    expect(traducirErrorPagoProveedor(null)).toMatch(/Inténtalo/);
    expect(traducirErrorPagoProveedor({})).toMatch(/Inténtalo/);
  });
});
