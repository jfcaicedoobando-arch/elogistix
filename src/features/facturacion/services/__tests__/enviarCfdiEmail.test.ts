import { describe, it, expect, vi, beforeEach } from "vitest";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

import { enviarCfdiFactura, enviarCfdiRep, enviarCfdiNotaCredito } from "../enviarCfdiEmail";

describe("enviarCfdiEmail", () => {
  beforeEach(() => invoke.mockReset());

  it("enviarCfdiFactura pasa factura_id y email", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true, enviado_a: "x@y.com" }, error: null });
    await expect(enviarCfdiFactura("f1", "x@y.com")).resolves.toEqual({ ok: true, enviado_a: "x@y.com" });
    expect(invoke).toHaveBeenCalledWith("facturapi-enviar-email", {
      body: { factura_id: "f1", pago_id: undefined, nota_credito_id: undefined, email: "x@y.com" },
    });
  });

  it("enviarCfdiRep usa pago_id", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true, enviado_a: "a@b.com" }, error: null });
    await enviarCfdiRep("p1");
    expect(invoke.mock.calls[0][1].body).toMatchObject({ pago_id: "p1", factura_id: undefined });
  });

  it("enviarCfdiNotaCredito usa nota_credito_id", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: true, enviado_a: "z@z.com" }, error: null });
    await enviarCfdiNotaCredito("nc1", "z@z.com");
    expect(invoke.mock.calls[0][1].body).toMatchObject({ nota_credito_id: "nc1", email: "z@z.com" });
  });

  it("lanza error de transporte", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { message: "net" } });
    await expect(enviarCfdiFactura("f1")).rejects.toThrow("net");
  });

  it("lanza cuando ok=false con fallback de mensaje", async () => {
    invoke.mockResolvedValueOnce({ data: { ok: false, message: "rechazado" }, error: null });
    await expect(enviarCfdiFactura("f1")).rejects.toThrow("rechazado");
    invoke.mockResolvedValueOnce({ data: { ok: true, enviado_a: "" }, error: null });
    await expect(enviarCfdiFactura("f1")).rejects.toThrow("No se pudo enviar el CFDI.");
  });
});
