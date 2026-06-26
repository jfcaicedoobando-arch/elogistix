import { describe, it, expect, vi, beforeEach } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

import { emitirRep, cancelarRep } from "../repFacturapi";

describe("repFacturapi service", () => {
  beforeEach(() => invoke.mockReset());

  it("emitirRep posts pago_id and returns timbrado payload", async () => {
    const payload = { uuid: "U", folio: 9, serie: "P", facturapi_id: "fx", pdf_url: "p", xml_url: "x" };
    invoke.mockResolvedValueOnce({ data: payload, error: null });
    await expect(emitirRep("p1")).resolves.toEqual(payload);
    expect(invoke).toHaveBeenCalledWith("facturapi-emitir-rep", { body: { pago_id: "p1" } });
  });

  it("emitirRep throws transport error", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { message: "net" } });
    await expect(emitirRep("p1")).rejects.toThrow("net");
  });

  it("emitirRep concatena issues", async () => {
    invoke.mockResolvedValueOnce({
      data: { error: "E", message: "Falló", issues: [{ field: "monto", message: "monto inválido" }] },
      error: null,
    });
    await expect(emitirRep("p1")).rejects.toThrow("Falló: monto inválido");
  });

  it("emitirRep falls back to error code", async () => {
    invoke.mockResolvedValueOnce({ data: { error: "E_CODE" }, error: null });
    await expect(emitirRep("p1")).rejects.toThrow("E_CODE");
  });

  it("cancelarRep envía motivo y sustituye_uuid", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await expect(cancelarRep("p1", "01", "UUID")).resolves.toBeUndefined();
    expect(invoke).toHaveBeenCalledWith("facturapi-cancelar-rep", {
      body: { pago_id: "p1", motivo: "01", sustituye_uuid: "UUID" },
    });
  });

  it("cancelarRep propaga errores", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { message: "x" } });
    await expect(cancelarRep("p1", "02")).rejects.toThrow("x");
    invoke.mockResolvedValueOnce({ data: { error: "NO" }, error: null });
    await expect(cancelarRep("p1", "02")).rejects.toThrow("NO");
  });
});
