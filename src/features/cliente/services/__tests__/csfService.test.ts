import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseCsf } from "@/features/cliente/services/csf";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({
        data: { session: { access_token: "test-token" } },
      }),
    },
  },
}));

describe("csfService.parseCsf", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "anon-key");
  });

  afterEach(() => {
    // vi.stubGlobal + unstubAllGlobals: evita leak de fetch entre archivos del
    // shard bajo singleFork (auditoría 13.137.28 - ALTA).
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("devuelve los datos parseados cuando la edge function responde OK", async () => {
    const parsed = { nombre: "ACME", rfc: "ACM010101AAA", cp: "01000" };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(parsed),
    });
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["%PDF-1.4"], "csf.pdf", { type: "application/pdf" });
    const result = await parseCsf(file);

    expect(result).toEqual(parsed);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://test.supabase.co/functions/v1/parse-csf",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-token",
        }),
      }),
    );
  });

  it("lanza el error reportado por la función", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "PDF inválido" }),
      }),
    );

    const file = new File(["x"], "csf.pdf", { type: "application/pdf" });
    await expect(parseCsf(file)).rejects.toThrow("PDF inválido");
  });

  it("lanza error genérico cuando el body no se puede parsear", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error("bad json")),
      }),
    );

    const file = new File(["x"], "csf.pdf", { type: "application/pdf" });
    await expect(parseCsf(file)).rejects.toThrow("Error al procesar el documento");
  });
});
