/**
 * P1-2 — La fecha de emisión es parte de la llave única de folio en BD
 * (proveedor + folio + fecha, vivas). Sin fecha, el schema debe bloquear el
 * submit para que el 23505 nunca llegue crudo al toast.
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

describe("facturaFormErrorsFromZod · fecha de emisión (P1-2)", () => {
  it("acepta el formulario cuando hay fecha de emisión", () => {
    expect(facturaFormErrorsFromZod(base, { total: 1160 })).toEqual({});
  });

  it("rechaza el submit cuando la fecha de emisión viene vacía", () => {
    const errores = facturaFormErrorsFromZod({ ...base, emision: "" }, { total: 1160 });
    expect(errores.emision).toBe("La fecha de emisión es obligatoria");
  });

  it("rechaza fecha de emisión con sólo espacios", () => {
    const errores = facturaFormErrorsFromZod({ ...base, emision: "   " }, { total: 1160 });
    expect(errores.emision).toBe("La fecha de emisión es obligatoria");
  });
});
