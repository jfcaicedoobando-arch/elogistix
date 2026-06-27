import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchTrackingPublico } from "@/features/embarques/services/tracking";

// Mock supabase client (el service lo importa solo para asegurar bundling)
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {},
}));

describe("trackingService.fetchTrackingPublico", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://testproject.supabase.co");
  });

  afterEach(() => {
    // vi.stubGlobal + unstubAllGlobals evita el leak transversal de fetch
    // entre archivos del shard bajo singleFork (auditoría 13.137.28 - ALTA).
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("devuelve los datos cuando la respuesta es 200", async () => {
    const payload = {
      embarque: { expediente: "EXP-1" },
      eventos: [],
      organizacion: { nombre: "Test", logo_url: null },
    };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(payload),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchTrackingPublico("abc123");
    expect(result).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://testproject.supabase.co/functions/v1/tracking-public?token=abc123",
    );
  });

  it("encodea correctamente tokens con caracteres especiales", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ embarque: {}, eventos: [], organizacion: null }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await fetchTrackingPublico("a/b+c=d");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://testproject.supabase.co/functions/v1/tracking-public?token=a%2Fb%2Bc%3Dd",
    );
  });

  it("lanza error con el mensaje del body cuando la respuesta no es OK", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: "Token expirado" }),
      }),
    );

    await expect(fetchTrackingPublico("xxx")).rejects.toThrow("Token expirado");
  });

  it("lanza error genérico cuando el body no es JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error("not json")),
      }),
    );

    await expect(fetchTrackingPublico("xxx")).rejects.toThrow("Error al cargar tracking");
  });
});
