/**
 * Tests para el wrapper `updateOwnPassword`.
 * Verifica delegación a `supabase.auth.updateUser` y propagación de errores.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const updateUserMock = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { updateUser: (args: unknown) => updateUserMock(args) } },
}));

import { updateOwnPassword } from "../changePassword";

describe("updateOwnPassword", () => {
  beforeEach(() => updateUserMock.mockReset());

  it("invoca updateUser con la nueva contraseña", async () => {
    updateUserMock.mockResolvedValue({ error: null });
    await updateOwnPassword("nuevaPass123");
    expect(updateUserMock).toHaveBeenCalledWith({ password: "nuevaPass123" });
  });

  it("lanza cuando Supabase devuelve error", async () => {
    const err = { code: "weak_password", message: "weak" };
    updateUserMock.mockResolvedValue({ error: err });
    await expect(updateOwnPassword("123")).rejects.toBe(err);
  });
});
