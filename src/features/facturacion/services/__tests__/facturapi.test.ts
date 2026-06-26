import { describe, it, expect, vi, beforeEach } from "vitest";

const invoke = vi.fn();
const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke }, rpc },
}));

import {
  emitirFacturapi,
  cancelarFacturapi,
  duplicarFacturaParaSustitucion,
} from "../facturapi";

describe("facturapi service", () => {
  beforeEach(() => { invoke.mockReset(); rpc.mockReset(); });

  it("emitirFacturapi returns the timbrado payload on success", async () => {
    const payload = { uuid: "U", folio: 1, serie: "A", facturapi_id: "fx", pdf_url: "p", xml_url: "x" };
    invoke.mockResolvedValueOnce({ data: payload, error: null });
    await expect(emitirFacturapi("f1")).resolves.toEqual(payload);
    expect(invoke).toHaveBeenCalledWith("facturapi-emitir", { body: { factura_id: "f1" } });
  });

  it("emitirFacturapi throws the transport error message", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { message: "network" } });
    await expect(emitirFacturapi("f1")).rejects.toThrow("network");
  });

  it("emitirFacturapi concatenates issue messages when provided", async () => {
    invoke.mockResolvedValueOnce({
      data: { error: "VALIDATION", message: "Datos inválidos", issues: [{ field: "rfc", message: "RFC inválido" }, { field: "cp", message: "CP requerido" }] },
      error: null,
    });
    await expect(emitirFacturapi("f1")).rejects.toThrow("Datos inválidos: RFC inválido; CP requerido");
  });

  it("emitirFacturapi falls back to error code when message missing", async () => {
    invoke.mockResolvedValueOnce({ data: { error: "BOOM" }, error: null });
    await expect(emitirFacturapi("f1")).rejects.toThrow("BOOM");
  });

  it("cancelarFacturapi pasa motivo y sustituye_uuid en el body", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true, sustituida: true }, error: null });
    const res = await cancelarFacturapi("f1", "01", "UUID-1", "f2");
    expect(res).toEqual({ sustituida: true });
    expect(invoke).toHaveBeenCalledWith("facturapi-cancelar", {
      body: { factura_id: "f1", motivo: "01", sustituye_uuid: "UUID-1", sustituida_por_factura_id: "f2" },
    });
  });

  it("cancelarFacturapi returns sustituida=false when omitted", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await expect(cancelarFacturapi("f1", "02")).resolves.toEqual({ sustituida: false });
  });

  it("cancelarFacturapi propaga error de transporte y de data.error", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    await expect(cancelarFacturapi("f1", "02")).rejects.toThrow("boom");
    invoke.mockResolvedValueOnce({ data: { error: "X", message: "No se puede cancelar" }, error: null });
    await expect(cancelarFacturapi("f1", "02")).rejects.toThrow("No se puede cancelar");
  });

  it("duplicarFacturaParaSustitucion devuelve el uuid del clon", async () => {
    rpc.mockResolvedValueOnce({ data: "new-id", error: null });
    await expect(duplicarFacturaParaSustitucion("f1")).resolves.toBe("new-id");
    expect(rpc).toHaveBeenCalledWith("duplicar_factura_para_sustitucion", { p_factura_id: "f1" });
  });

  it("duplicarFacturaParaSustitucion throws when RPC fails or returns null", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { message: "bad" } });
    await expect(duplicarFacturaParaSustitucion("f1")).rejects.toThrow("bad");
    rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(duplicarFacturaParaSustitucion("f1")).rejects.toThrow("No se pudo duplicar");
  });
});
