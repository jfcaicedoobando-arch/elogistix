/**
 * Tests de traducción de errores 23505 en la captura de facturas de proveedor.
 *
 * R4 P1-2: la llave única viva es (proveedor, folio, fecha_emision). El error
 * crudo de Postgres nunca debe llegar al toast: se traduce a un mensaje que
 * dice qué cambiar.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const notifyError = vi.hoisted(() => vi.fn());
const buscarCfdiDuplicado = vi.hoisted(() => vi.fn());

vi.mock("@/lib/ui/appFeedback", () => ({ notifyError, notifySuccess: vi.fn() }));
vi.mock("../useNuevaFacturaProveedorForm.dup", () => ({
  buscarCfdiDuplicado,
  describirFacturaExistente: () => "FP-000123 · Vigente · aprobada",
}));

import { handleSubmitError } from "../useNuevaFacturaProveedorForm.submit";

describe("handleSubmitError · constraint de folio duplicado", () => {
  beforeEach(() => {
    notifyError.mockReset();
    buscarCfdiDuplicado.mockReset();
  });

  it("traduce el constraint proveedor_facturas_org_prov_folio_uq", async () => {
    await handleSubmitError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "proveedor_facturas_org_prov_folio_uq"',
      constraint: "proveedor_facturas_org_prov_folio_uq",
    });

    expect(notifyError).toHaveBeenCalledTimes(1);
    const [, opts] = notifyError.mock.calls[0];
    expect(opts.title).toBe("Folio duplicado para este proveedor");
    expect(opts.description).toMatch(/folio y fecha de emisión/i);
    expect(buscarCfdiDuplicado).not.toHaveBeenCalled();
  });

  it("prioriza el duplicado de UUID fiscal sobre el de folio", async () => {
    buscarCfdiDuplicado.mockResolvedValue({ estado: "existe", factura: { id: "f-1" } });

    await handleSubmitError({
      code: "23505",
      message: 'duplicate key value violates unique constraint "proveedor_facturas_uuid_fiscal_uq"',
      constraint: "proveedor_facturas_uuid_fiscal_uq",
    }, "UUID-1");

    const [, opts] = notifyError.mock.calls[0];
    expect(opts.title).toBe("Este CFDI ya está capturado");
    expect(buscarCfdiDuplicado).toHaveBeenCalledWith("UUID-1");
  });

  it("no deja pasar el mensaje crudo cuando el 23505 es de otra llave", async () => {
    await handleSubmitError({ code: "23505", message: 'duplicate key value violates unique constraint "otra_uq"' });
    const [, opts] = notifyError.mock.calls[0];
    expect(opts.title).toBe("Registro duplicado");
  });
});
