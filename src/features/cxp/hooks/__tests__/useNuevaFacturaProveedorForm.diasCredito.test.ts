/**
 * EC-18 — `diasCredito` acotado (0–365, entero) y vencimiento en rango razonable.
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

describe("facturaFormErrorsFromZod · EC-18 (diasCredito)", () => {
  it("acepta el caso base", () => {
    expect(facturaFormErrorsFromZod(base, { total: 1160 })).toEqual({});
  });

  it("rechaza días de crédito negativos, fraccionarios o mayores a 365", () => {
    expect(facturaFormErrorsFromZod({ ...base, diasCredito: -30 }, { total: 1160 }).diasCredito)
      .toBe("Los días de crédito no pueden ser negativos");
    expect(facturaFormErrorsFromZod({ ...base, diasCredito: 15.5 }, { total: 1160 }).diasCredito)
      .toBe("Los días de crédito deben ser un número entero");
    expect(facturaFormErrorsFromZod({ ...base, diasCredito: 99999 }, { total: 1160 }).diasCredito)
      .toBe("Los días de crédito no pueden ser mayores a 365");
  });

  it("rechaza un vencimiento absurdamente lejano a la emisión", () => {
    const errores = facturaFormErrorsFromZod(
      { ...base, vencimiento: "2299-01-01" },
      { total: 1160 },
    );
    expect(errores.vencimiento).toBe(
      "La fecha de vencimiento está demasiado lejos de la emisión",
    );
  });

  it("permite vencimiento dentro de un año de la emisión", () => {
    const errores = facturaFormErrorsFromZod(
      { ...base, diasCredito: 365, vencimiento: "2027-07-31" },
      { total: 1160 },
    );
    expect(errores.vencimiento).toBeUndefined();
    expect(errores.diasCredito).toBeUndefined();
  });
});
