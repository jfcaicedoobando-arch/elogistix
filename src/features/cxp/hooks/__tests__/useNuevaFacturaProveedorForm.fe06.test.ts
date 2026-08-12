/**
 * FE-06 — Captura CxP: componentes negativos, vencimiento < emisión y tope de TC.
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
  moneda: "MXN",
  tc: "1",
  subtotal: "1000",
  iva: "160",
  ieps: "0",
  retenciones: "0",
  categoriaId: "cat-1",
  notas: "",
};

describe("facturaFormErrorsFromZod · FE-06", () => {
  it("rechaza subtotal negativo aunque el total quede positivo", () => {
    const errores = facturaFormErrorsFromZod(
      { ...base, subtotal: "-100", iva: "200" },
      { total: 100 },
    );
    expect(errores.subtotal).toBe("El subtotal no puede ser negativo");
  });

  it("rechaza IVA, IEPS y retenciones negativos", () => {
    expect(facturaFormErrorsFromZod({ ...base, iva: "-1" }, { total: 999 }).iva)
      .toBe("El IVA no puede ser negativo");
    expect(facturaFormErrorsFromZod({ ...base, ieps: "-1" }, { total: 999 }).ieps)
      .toBe("El IEPS no puede ser negativo");
    expect(facturaFormErrorsFromZod({ ...base, retenciones: "-1" }, { total: 999 }).retenciones)
      .toBe("Las retenciones no pueden ser negativas");
  });

  it("rechaza vencimiento anterior a la emisión", () => {
    const errores = facturaFormErrorsFromZod(
      { ...base, vencimiento: "2026-07-01" },
      { total: 1160 },
    );
    expect(errores.vencimiento).toBe(
      "La fecha de vencimiento no puede ser anterior a la fecha de emisión",
    );
  });

  it("rechaza tipo de cambio mayor a 1000", () => {
    const errores = facturaFormErrorsFromZod(
      { ...base, moneda: "USD", tc: "1500" },
      { total: 1160 },
    );
    expect(errores.tc).toBe("El tipo de cambio no puede ser mayor a 1000");
  });

  it("acepta el caso válido (regresión)", () => {
    expect(facturaFormErrorsFromZod(base, { total: 1160 })).toEqual({});
  });
});
