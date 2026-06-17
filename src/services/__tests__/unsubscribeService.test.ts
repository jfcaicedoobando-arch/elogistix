/**
 * Cobertura del wrapper que encapsula la edge function
 * `handle-email-unsubscribe` (Fase 1 item #4).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { invokeMock } = vi.hoisted(() => ({ invokeMock: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: invokeMock } },
}));

import { validateUnsubscribeToken, confirmUnsubscribe } from "../unsubscribeService";

beforeEach(() => invokeMock.mockReset());

describe("validateUnsubscribeToken", () => {
  it("propaga el payload cuando la edge function responde OK", async () => {
    invokeMock.mockResolvedValueOnce({ data: { valid: true }, error: null });
    await expect(validateUnsubscribeToken("tok-1")).resolves.toEqual({ valid: true });
    expect(invokeMock).toHaveBeenCalledWith(
      "handle-email-unsubscribe?token=tok-1",
      { method: "GET" },
    );
  });

  it("URL-encodea el token", async () => {
    invokeMock.mockResolvedValueOnce({ data: { valid: true }, error: null });
    await validateUnsubscribeToken("a b+c/d");
    expect(invokeMock.mock.calls[0][0]).toBe("handle-email-unsubscribe?token=a%20b%2Bc%2Fd");
  });

  it("lanza cuando la edge function devuelve error", async () => {
    const err = new Error("boom");
    invokeMock.mockResolvedValueOnce({ data: null, error: err });
    await expect(validateUnsubscribeToken("tok")).rejects.toBe(err);
  });

  it("fallback `{ valid: false }` cuando data es null", async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: null });
    await expect(validateUnsubscribeToken("tok")).resolves.toEqual({ valid: false });
  });
});

describe("confirmUnsubscribe", () => {
  it("envía POST con body { token }", async () => {
    invokeMock.mockResolvedValueOnce({ data: { success: true }, error: null });
    await expect(confirmUnsubscribe("tok-X")).resolves.toEqual({ success: true });
    expect(invokeMock).toHaveBeenCalledWith("handle-email-unsubscribe", {
      method: "POST",
      body: { token: "tok-X" },
    });
  });

  it("propaga error de invoke", async () => {
    const err = new Error("network");
    invokeMock.mockResolvedValueOnce({ data: null, error: err });
    await expect(confirmUnsubscribe("tok")).rejects.toBe(err);
  });

  it("fallback cuando data es null", async () => {
    invokeMock.mockResolvedValueOnce({ data: null, error: null });
    await expect(confirmUnsubscribe("tok")).resolves.toEqual({
      success: false,
      error: "No se pudo procesar la baja",
    });
  });
});
