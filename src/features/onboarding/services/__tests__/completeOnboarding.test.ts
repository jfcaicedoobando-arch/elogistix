/**
 * Ola 4 · N30: complete_onboarding ya no elige una org arbitraria — el
 * caller debe pasar `_organization_id` explícito (organización activa del
 * usuario), no dejar que la RPC adivine con LIMIT 1.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc },
}));

const { completeOnboarding } = await import(
  "@/features/onboarding/services/completeOnboarding"
);

describe("completeOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("envía _organization_id explícito junto con el resto de los parámetros", async () => {
    rpc.mockResolvedValue({ error: null });

    await completeOnboarding({
      organizationId: "org-123",
      rfc: "XAXX010101000",
      direccion: "Calle Falsa 123",
      moneda: "MXN",
    });

    expect(rpc).toHaveBeenCalledWith("complete_onboarding", {
      _organization_id: "org-123",
      _rfc: "XAXX010101000",
      _direccion: "Calle Falsa 123",
      _moneda: "MXN",
    });
  });

  it("propaga el error de la RPC (p.ej. usuario sin membresía admin en esa org)", async () => {
    rpc.mockResolvedValue({ error: { message: "LC_ONBOARDING_SIN_ROL" } });

    await expect(
      completeOnboarding({
        organizationId: "org-ajena",
        rfc: "",
        direccion: "",
        moneda: "MXN",
      }),
    ).rejects.toEqual({ message: "LC_ONBOARDING_SIN_ROL" });
  });
});
