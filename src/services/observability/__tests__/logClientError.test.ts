import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: vi.fn().mockResolvedValue({ data: null, error: null }) } },
}));

import { supabase } from "@/integrations/supabase/client";
import { logClientError } from "@/services/observability/logClientError";
import { APP_VERSION } from "@/constants/appVersion";

const invoke = supabase.functions.invoke as ReturnType<typeof vi.fn>;

beforeEach(() => { invoke.mockClear(); });

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

  it("no propaga errores aunque invoke lance síncronamente", () => {
    invoke.mockImplementationOnce(() => { throw new Error("network"); });
    expect(() => logClientError({ message: "x" })).not.toThrow();
  });
});
