import { describe, it, expect, vi, beforeEach } from "vitest";

const supabaseMock = vi.hoisted(() => ({
  functions: { invoke: vi.fn() },
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: supabaseMock }));

import { verificarUuidSat } from "@/features/cxp/services/verificarUuidSat";

beforeEach(() => {
  supabaseMock.functions.invoke.mockReset();
});

describe("verificarUuidSat", () => {
  it("devuelve el estatus cuando la edge function responde ok", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { estatus: "Vigente", raw: "S - 200 | Vigente" },
      error: null,
    });
    const r = await verificarUuidSat("fact-1");
    expect(r.estatus).toBe("Vigente");
    expect(supabaseMock.functions.invoke).toHaveBeenCalledWith(
      "verificar-uuid-sat",
      { body: { factura_id: "fact-1" } },
    );
  });

  it("lanza cuando la edge function devuelve error de transporte", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: null,
      error: new Error("boom"),
    });
    await expect(verificarUuidSat("fact-2")).rejects.toThrow("boom");
  });

  it("lanza usando `detail` cuando el payload trae error de negocio", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { error: "rfc_receptor_missing", detail: "Org sin RFC configurado" },
      error: null,
    });
    await expect(verificarUuidSat("fact-3")).rejects.toThrow("Org sin RFC configurado");
  });

  it("cae al `error` cuando no hay detail", async () => {
    supabaseMock.functions.invoke.mockResolvedValue({
      data: { error: "unauthorized" },
      error: null,
    });
    await expect(verificarUuidSat("fact-4")).rejects.toThrow("unauthorized");
  });
});
