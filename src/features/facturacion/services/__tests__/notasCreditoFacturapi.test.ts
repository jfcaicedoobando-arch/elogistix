import { describe, it, expect, vi, beforeEach } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

import { timbrarNotaCreditoFacturapi, cancelarNotaCreditoFacturapi } from "../notasCreditoFacturapi";

describe("notasCreditoFacturapi service", () => {
  beforeEach(() => invoke.mockReset());

  it("timbrar returns payload on success", async () => {
    const payload = { uuid: "U", folio: 3, serie: "E", facturapi_id: "fx", pdf_url: "p", xml_url: "x" };
    invoke.mockResolvedValueOnce({ data: payload, error: null });
    await expect(timbrarNotaCreditoFacturapi("nc1")).resolves.toEqual(payload);
    expect(invoke).toHaveBeenCalledWith("facturapi-emitir-nota-credito", { body: { nota_credito_id: "nc1" } });
  });

  it("timbrar concatena issues si existen", async () => {
    invoke.mockResolvedValueOnce({
      data: { error: "X", message: "Inválido", issues: [{ field: "f", message: "m1" }, { field: "g", message: "m2" }] },
      error: null,
    });
    await expect(timbrarNotaCreditoFacturapi("nc1")).rejects.toThrow("Inválido: m1; m2");
  });

  it("timbrar omite el sufijo cuando issues está vacío", async () => {
    invoke.mockResolvedValueOnce({ data: { error: "X", message: "Bad", issues: [] }, error: null });
    await expect(timbrarNotaCreditoFacturapi("nc1")).rejects.toThrow(/^Bad$/);
  });

  it("timbrar propaga error de transporte", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(timbrarNotaCreditoFacturapi("nc1")).rejects.toThrow("boom");
  });

  it("cancelar envía body completo y propaga errores", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await cancelarNotaCreditoFacturapi("nc1", "01", "UUID");
    expect(invoke).toHaveBeenCalledWith("facturapi-cancelar-nota-credito", {
      body: { nota_credito_id: "nc1", motivo: "01", sustituye_uuid: "UUID" },
    });
    invoke.mockResolvedValueOnce({ data: { error: "NO", message: "no" }, error: null });
    await expect(cancelarNotaCreditoFacturapi("nc1", "02")).rejects.toThrow("no");
  });

  it("cancelar propaga uncertain=true (timeout con verifying persistido)", async () => {
    invoke.mockResolvedValueOnce({
      data: { ok: true, pending: true, uncertain: true, message: "verificando" },
      error: null,
    });
    await expect(cancelarNotaCreditoFacturapi("nc1", "02")).resolves.toEqual({
      pending: true,
      uncertain: true,
      message: "verificando",
    });
  });

  it("cancelar normaliza uncertain ausente a false", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true, pending: false }, error: null });
    await expect(cancelarNotaCreditoFacturapi("nc1", "02")).resolves.toEqual({
      pending: false,
      uncertain: false,
      message: undefined,
    });
  });
});
