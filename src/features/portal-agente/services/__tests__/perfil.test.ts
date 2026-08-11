/**
 * `actualizarPasswordAgente` sólo puede cambiar la contraseña del usuario
 * autenticado (Supabase Auth resuelve el usuario objetivo por el JWT de la
 * sesión activa; no se puede pasar un `userId` arbitrario), y debe propagar
 * cualquier error de Supabase.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const updateUser = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { updateUser } },
}));

const { actualizarPasswordAgente } = await import("@/features/portal-agente/services/perfil");

describe("portal-agente/services/perfil · actualizarPasswordAgente", () => {
  beforeEach(() => {
    updateUser.mockReset();
  });

  it("llama a auth.updateUser sólo con { password }, sin id de usuario/agente manipulable", async () => {
    updateUser.mockResolvedValue({ error: null });
    await actualizarPasswordAgente("nuevaClave123!");
    expect(updateUser).toHaveBeenCalledTimes(1);
    expect(updateUser).toHaveBeenCalledWith({ password: "nuevaClave123!" });
  });

  it("propaga el error de Supabase al cambiar la contraseña", async () => {
    updateUser.mockResolvedValue({ error: { message: "weak password" } });
    await expect(actualizarPasswordAgente("123")).rejects.toThrow(/weak password/i);
  });
});
