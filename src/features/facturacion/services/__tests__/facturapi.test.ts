import { describe, it, expect, vi, beforeEach } from "vitest";

const { invoke, rpc } = vi.hoisted(() => ({ invoke: vi.fn(), rpc: vi.fn() }));
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

  it("emitirFacturapi extrae el mensaje humano del body cuando la edge function responde non-2xx", async () => {
    // Simula el FunctionsHttpError real de @supabase/supabase-js v2: el body va
    // en `error.context` como una `Response`; `error.message` es genérico.
    const context = new Response(
      JSON.stringify({
        error: "org_facturapi_not_configured",
        message: "Esta organización no tiene FacturApi configurado. Ve a Configuración → Facturación electrónica.",
      }),
      { status: 412 },
    );
    const httpError = Object.assign(new Error("Edge Function returned a non-2xx status code"), { context });
    invoke.mockResolvedValueOnce({ data: null, error: httpError });
    await expect(emitirFacturapi("f1")).rejects.toThrow(
      "Esta organización no tiene FacturApi configurado. Ve a Configuración → Facturación electrónica.",
    );
  });

  it("cancelarFacturapi pasa motivo y sustituye_uuid en el body", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true, sustituida: true }, error: null });
    const res = await cancelarFacturapi("f1", "01", "UUID-1", "f2");
    expect(res).toMatchObject({ sustituida: true });
    expect(invoke).toHaveBeenCalledWith("facturapi-cancelar", {
      body: { factura_id: "f1", motivo: "01", sustituye_uuid: "UUID-1", sustituida_por_factura_id: "f2" },
    });
  });

  it("cancelarFacturapi returns sustituida=false when omitted", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await expect(cancelarFacturapi("f1", "02")).resolves.toMatchObject({ sustituida: false });
  });

  it("cancelarFacturapi propaga uncertain del 202 de timeout", async () => {
    invoke.mockResolvedValueOnce({
      data: { ok: true, pending: true, uncertain: true, cancellation_status: "verifying", message: "verificando" },
      error: null,
    });
    await expect(cancelarFacturapi("f1", "02")).resolves.toMatchObject({
      pending: true,
      uncertain: true,
      cancellation_status: "verifying",
    });
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
