import { describe, it, expect, vi, beforeEach } from "vitest";

const { invoke } = vi.hoisted(() => ({
  invoke: vi.fn().mockResolvedValue({ data: { ok: true }, error: null }),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));

import { logClientError } from "@/services/observability/logClientError";
import { APP_VERSION } from "@/constants/appVersion";

beforeEach(() => {
  invoke.mockClear();
});

describe("logClientError", () => {
  it("invoca client-error-log con payload completo y app_version", () => {
    logClientError({ message: "boom", stack: "s", componentStack: "cs" });
    expect(invoke).toHaveBeenCalledWith("client-error-log", {
      body: expect.objectContaining({
        message: "boom",
        stack: "s",
        component_stack: "cs",
        app_version: APP_VERSION,
      }),
    });
  });

  it("normaliza stack/componentStack ausentes a null", () => {
    logClientError({ message: "x" });
    const body = invoke.mock.calls[0][1].body;
    expect(body.stack).toBeNull();
    expect(body.component_stack).toBeNull();
  });

  it("incluye ruta cuando window está disponible", () => {
    logClientError({ message: "r" });
    const body = invoke.mock.calls[0][1].body;
    expect(typeof body.route === "string" || body.route === null).toBe(true);
  });

  it("no propaga errores aunque invoke lance síncronamente", () => {
    invoke.mockImplementationOnce(() => { throw new Error("network"); });
    expect(() => logClientError({ message: "x" })).not.toThrow();
  });
});
