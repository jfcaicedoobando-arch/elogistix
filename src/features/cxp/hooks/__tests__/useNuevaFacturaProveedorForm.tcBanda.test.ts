/**
 * MNY — Guard compartido de plausibilidad del T/C (banda 5–40 MXN por divisa)
 * en la captura de facturas de proveedor. Antes sólo se exigía positivo y <1000,
 * así que un dedazo (185 o 1.85) pasaba y distorsionaba el equivalente en MXN.
 */
import { describe, it, expect } from "vitest";
import { facturaFormErrorsFromZod } from "@/features/cxp/hooks/useNuevaFacturaProveedorForm.schema";
import type { FacturaFormValues } from "@/features/cxp/types";

const base: FacturaFormValues = {
  provId: "prov-1",
  provNombre: "Naviera SA",
  folio: "A-100",
  emision: "2026-07-31",
  diasCredito: 30,
  vencimiento: "2026-08-30",
  moneda: "USD",
  tc: "18.5",
  subtotal: "1000",
  iva: "160",
  ieps: "0",
  retenciones: "0",
  categoriaId: "cat-1",
  notas: "",
};

const ctx = { total: 1160 };

describe("facturaFormErrorsFromZod · banda de T/C (MNY)", () => {
  it("acepta el T/C de una factura de proveedor dentro de la banda", () => {
    expect(facturaFormErrorsFromZod(base, ctx).tc).toBeUndefined();
  });

  it("rechaza un T/C demasiado alto (185)", () => {
    const errs = facturaFormErrorsFromZod({ ...base, tc: "185" }, ctx);
    expect(errs.tc).toMatch(/parece incorrecto/i);
  });

  it("rechaza un T/C demasiado bajo (1.85)", () => {
    const errs = facturaFormErrorsFromZod({ ...base, tc: "1.85" }, ctx);
    expect(errs.tc).toMatch(/parece incorrecto/i);
  });

  it("conserva el mensaje de T/C requerido cuando está vacío", () => {
    const errs = facturaFormErrorsFromZod({ ...base, tc: "" }, ctx);
    expect(errs.tc).toBeDefined();
    expect(errs.tc).not.toMatch(/parece incorrecto/i);
  });

  it("no aplica la banda cuando la factura es en MXN", () => {
    const errs = facturaFormErrorsFromZod({ ...base, moneda: "MXN", tc: "1" }, ctx);
    expect(errs.tc).toBeUndefined();
  });
});
