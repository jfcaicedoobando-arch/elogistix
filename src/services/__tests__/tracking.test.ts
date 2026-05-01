import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchTrackingPublico } from "@/services/tracking";

// Mock supabase client (el service lo importa solo para asegurar bundling)
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

describe("trackingService.fetchTrackingPublico", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_PROJECT_ID", "testproject");
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllEnvs();
  });

  it("devuelve los datos cuando la respuesta es 200", async () => {
    const payload = {
      embarque: { expediente: "EXP-1" },
      eventos: [],
      organizacion: { nombre: "Test", logo_url: null },
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    }) as unknown as typeof fetch;

    const result = await fetchTrackingPublico("abc123");
    expect(result).toEqual(payload);
    expect(global.fetch).toHaveBeenCalledWith(
      "https://testproject.supabase.co/functions/v1/tracking-public?token=abc123",
    );
  });

  it("encodea correctamente tokens con caracteres especiales", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ embarque: {}, eventos: [], organizacion: null }),
    }) as unknown as typeof fetch;

    await fetchTrackingPublico("a/b+c=d");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://testproject.supabase.co/functions/v1/tracking-public?token=a%2Fb%2Bc%3Dd",
    );
  });

  it("lanza error con el mensaje del body cuando la respuesta no es OK", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Token expirado" }),
    }) as unknown as typeof fetch;

    await expect(fetchTrackingPublico("xxx")).rejects.toThrow("Token expirado");
  });

  it("lanza error genérico cuando el body no es JSON", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: () => Promise.reject(new Error("not json")),
    }) as unknown as typeof fetch;

    await expect(fetchTrackingPublico("xxx")).rejects.toThrow("Error al cargar tracking");
  });
});
