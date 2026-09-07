import { beforeEach, describe, expect, it, vi } from "vitest";

const { getSession, refreshSession } = vi.hoisted(() => ({
  getSession: vi.fn(),
  refreshSession: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession, refreshSession } },
}));

import { ensureFreshSession } from "../ensureFreshSession";

const sesionVigente = {
  access_token: "token-rechazado",
  expires_at: Math.floor(Date.now() / 1000) + 600,
};

describe("ensureFreshSession", () => {
  beforeEach(() => {
    getSession.mockReset();
    refreshSession.mockReset();
  });

  it("no reutiliza un token rechazado cuando falla la renovación forzada", async () => {
    getSession.mockResolvedValue({ data: { session: sesionVigente } });
    refreshSession.mockResolvedValue({
      data: { session: null },
      error: new Error("Invalid Refresh Token: Refresh Token Not Found"),
    });

    await expect(ensureFreshSession(true)).resolves.toBeNull();
    expect(refreshSession).toHaveBeenCalledOnce();
  });

  it("conserva el respaldo para una renovación preventiva concurrente", async () => {
    const sesionPorVencer = {
      access_token: "token-anterior",
      expires_at: Math.floor(Date.now() / 1000) + 30,
    };
    getSession
      .mockResolvedValueOnce({ data: { session: sesionPorVencer } })
      .mockResolvedValueOnce({ data: { session: sesionVigente } });
    refreshSession.mockResolvedValue({
      data: { session: null },
      error: new Error("Already Used"),
    });

    await expect(ensureFreshSession()).resolves.toBe("token-rechazado");
  });
});