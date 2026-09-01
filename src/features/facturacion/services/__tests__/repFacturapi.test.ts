import { describe, it, expect, vi, beforeEach } from "vitest";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

import { emitirRep, cancelarRep, esRepYaTimbrado } from "../repFacturapi";

/** Simula lo que hace `supabase.functions.invoke` con status ≠ 2xx. */
function httpError(status: number, body: unknown) {
  return {
    message: "Edge Function returned a non-2xx status code",
    context: new Response(JSON.stringify(body), { status }),
  };
}

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
    await expect(cancelarRep("p1", "01", "UUID")).resolves.toEqual({
      ok: true,
      pending: false,
      uncertain: false,
      cancellation_status: "accepted",
      message: null,
    });
    expect(invoke).toHaveBeenCalledWith("facturapi-cancelar-rep", {
      body: { pago_id: "p1", motivo: "01", sustituye_uuid: "UUID" },
    });
  });

  it("cancelarRep conserva el estado asíncrono de verificación", async () => {
    invoke.mockResolvedValueOnce({
      data: {
        ok: true,
        pending: true,
        cancellation_status: "verifying",
        message: "Cancelación enviada al SAT.",
      },
      error: null,
    });
    await expect(cancelarRep("p1", "02")).resolves.toEqual({
      ok: true,
      pending: true,
      uncertain: false,
      cancellation_status: "verifying",
      message: "Cancelación enviada al SAT.",
    });
  });

  it("cancelarRep propaga uncertain=true (timeout con verifying persistido)", async () => {
    invoke.mockResolvedValueOnce({
      data: {
        ok: true,
        pending: true,
        uncertain: true,
        cancellation_status: "verifying",
        message: "La solicitud fue enviada, pero FacturApi tardó en confirmar.",
      },
      error: null,
    });
    await expect(cancelarRep("p1", "02")).resolves.toEqual({
      ok: true,
      pending: true,
      uncertain: true,
      cancellation_status: "verifying",
      message: "La solicitud fue enviada, pero FacturApi tardó en confirmar.",
    });
  });

  it("cancelarRep propaga errores", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: { message: "x" } });
    await expect(cancelarRep("p1", "02")).rejects.toThrow("x");
    invoke.mockResolvedValueOnce({ data: { error: "NO" }, error: null });
    await expect(cancelarRep("p1", "02")).rejects.toThrow("NO");
  });

  it("emitirRep traduce el 409 ya_timbrado_rep a mensaje en español (no el genérico del SDK)", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: httpError(409, { error: "ya_timbrado_rep", message: "Este pago ya tiene REP timbrado." }),
    });
    const err = await emitirRep("p1").catch((e: unknown) => e);
    expect(esRepYaTimbrado(err)).toBe(true);
    expect((err as Error).message).toBe("Este pago ya tiene REP timbrado.");
  });

  it("emitirRep lee el cuerpo del 422 con las validaciones fiscales", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: httpError(422, {
        error: "validacion",
        message: "Datos fiscales incompletos",
        issues: [{ field: "regimen_fiscal", message: "régimen fiscal requerido" }],
      }),
    });
    const err = await emitirRep("p1").catch((e: unknown) => e);
    expect(esRepYaTimbrado(err)).toBe(false);
    expect((err as Error).message).toBe("Datos fiscales incompletos: régimen fiscal requerido");
  });

  it("cancelarRep también expone el mensaje real del backend", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: httpError(409, { error: "ya_cancelado", message: "El REP ya estaba cancelado." }),
    });
    await expect(cancelarRep("p1", "02")).rejects.toThrow("El REP ya estaba cancelado.");
  });
});
