import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { parseCsf } from "@/services/csfService";

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
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "anon-key");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("devuelve los datos parseados cuando la edge function responde OK", async () => {
    const parsed = { nombre: "ACME", rfc: "ACM010101AAA", cp: "01000" };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(parsed),
    }) as unknown as typeof fetch;

    const file = new File(["%PDF-1.4"], "csf.pdf", { type: "application/pdf" });
    const result = await parseCsf(file);

    expect(result).toEqual(parsed);
    expect(global.fetch).toHaveBeenCalledWith(
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
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "PDF inválido" }),
    }) as unknown as typeof fetch;

    const file = new File(["x"], "csf.pdf", { type: "application/pdf" });
    await expect(parseCsf(file)).rejects.toThrow("PDF inválido");
  });

  it("lanza error genérico cuando el body no se puede parsear", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("bad json")),
    }) as unknown as typeof fetch;

    const file = new File(["x"], "csf.pdf", { type: "application/pdf" });
    await expect(parseCsf(file)).rejects.toThrow("Error al procesar el documento");
  });
});
