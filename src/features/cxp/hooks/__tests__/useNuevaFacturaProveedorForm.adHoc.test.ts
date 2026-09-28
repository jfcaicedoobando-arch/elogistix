import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FacturaFormValues } from "@/features/cxp/types";

const crearConceptoCostoYVincular = vi.hoisted(() => vi.fn().mockResolvedValue({ conceptoId: "costo-1" }));
vi.mock("@/features/cxp/services", () => ({ crearConceptoCostoYVincular }));
vi.mock("../useNuevaFacturaProveedorForm.bestEffort", () => ({ notifyBestEffortFallo: vi.fn() }));

import { vincularSafe } from "../useNuevaFacturaProveedorForm.sideEffects";

const factura: FacturaFormValues = {
  provId: "proveedor-1",
  provNombre: "Maniobras Regias del Norte",
  folio: "AUD-ADHOC-001",
  emision: "2026-09-28",
  diasCredito: 0,
  vencimiento: "2026-09-28",
  moneda: "MXN",
  tc: "1",
  subtotal: "1000",
  iva: "160",
  ieps: "0",
  retenciones: "0",
  categoriaId: "categoria-1",
  notas: "Prueba de costo neto",
};

describe("costo ad hoc de factura proveedor", () => {
  beforeEach(() => crearConceptoCostoYVincular.mockClear());

  it.each([
    { iva: "160", ieps: "0", retenciones: "0", total: 1160 },
    { iva: "172.8", ieps: "80", retenciones: "0", total: 1252.8 },
    { iva: "160", ieps: "0", retenciones: "40", total: 1120 },
  ])("crea costo neto de 1000 aunque el total sea $total", async ({ iva, ieps, retenciones, total }) => {
    const result = await vincularSafe({
      facturaId: "factura-1",
      organizationId: "org-1",
      values: { ...factura, iva, ieps, retenciones },
      total,
      vinculos: {},
      embarqueAdHoc: { embarqueId: "embarque-1", expediente: "ELIMP00012", concepto: "Maniobras de patio" },
    });

    expect(result.conceptoAdHocExpediente).toBe("ELIMP00012");
    expect(crearConceptoCostoYVincular).toHaveBeenCalledOnce();
    expect(crearConceptoCostoYVincular).toHaveBeenCalledWith(expect.objectContaining({
      facturaId: "factura-1",
      embarqueId: "embarque-1",
      monto: 1000,
      moneda: "MXN",
    }));
  });
});
