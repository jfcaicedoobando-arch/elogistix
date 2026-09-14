/**
 * Lote B11–B15: los candados nuevos de la base deben llegar al usuario como
 * texto accionable, no como error técnico de Postgres.
 */
import { describe, it, expect } from "vitest";
import { getErrorMessage } from "@/lib/errors";

describe("mensajes LC_* del lote B11–B15", () => {
  it("tipo de cambio inválido en la exposición de crédito", () => {
    const msg = getErrorMessage(
      new Error("LC_CREDITO_TC_INVALIDO: corrige el tipo de cambio de la(s) factura(s) A-1, A-2"),
    );
    expect(msg).not.toMatch(/^LC_/);
    expect(msg.length).toBeGreaterThan(20);
  });

  it("concepto ya proformado explica cómo liberarlo", () => {
    const msg = getErrorMessage(new Error("LC_CONCEPTO_PROFORMADO: el concepto ya está incluido"));
    expect(msg).toMatch(/proforma/i);
    expect(msg).not.toMatch(/^LC_/);
  });

  it("costo vinculado a factura de proveedor indica desvincular primero", () => {
    const msg = getErrorMessage(new Error("LC_COSTO_VINCULADO_CXP: el costo está vinculado"));
    expect(msg).toMatch(/factura de proveedor/i);
    expect(msg).not.toMatch(/^LC_/);
  });

  it("sin permiso para eliminar proforma", () => {
    const msg = getErrorMessage(new Error("LC_PROFORMA_SIN_PERMISO: tu rol no puede eliminar"));
    expect(msg).toMatch(/permiso/i);
    expect(msg).not.toMatch(/^LC_/);
  });
});
