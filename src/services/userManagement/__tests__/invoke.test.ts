import { beforeEach, describe, expect, it, vi } from "vitest";

const { invoke, freshSession } = vi.hoisted(() => ({
  invoke: vi.fn(),
  freshSession: vi.fn(),
}));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke } },
}));
vi.mock("@/lib/auth/ensureFreshSession", () => ({ ensureFreshSession: freshSession }));

import { invokeUserManagement } from "../invoke";

const body = { action: "list" };
const ok = { data: [{ id: "usuario-mock" }], error: null };
const unauthorized = { data: null, error: { context: { status: 401 } } };

beforeEach(() => {
  invoke.mockReset().mockResolvedValue(ok);
  freshSession.mockReset().mockResolvedValue("token-vigente");
});

describe("invokeUserManagement: recuperación de sesión acotada", () => {
  it("envía el cuerpo y token vigente y devuelve el resultado original", async () => {
    await expect(invokeUserManagement(body)).resolves.toBe(ok);
    expect(invoke).toHaveBeenCalledExactlyOnceWith("user-management", {
      body, headers: { Authorization: "Bearer token-vigente" },
    });
  });

  it("ante 401 refresca y reintenta una sola vez con un token distinto", async () => {
    invoke.mockResolvedValueOnce(unauthorized).mockResolvedValueOnce(ok);
    freshSession.mockResolvedValueOnce("rechazado").mockResolvedValueOnce("nuevo");
    await expect(invokeUserManagement(body)).resolves.toBe(ok);
    expect(freshSession).toHaveBeenNthCalledWith(2, true, "rechazado");
    expect(invoke).toHaveBeenNthCalledWith(2, "user-management", {
      body, headers: { Authorization: "Bearer nuevo" },
    });
    expect(invoke).toHaveBeenCalledTimes(2);
  });

  it("no crea un bucle si el segundo intento también recibe 401", async () => {
    invoke.mockResolvedValue(unauthorized);
    freshSession.mockResolvedValueOnce("rechazado").mockResolvedValueOnce("nuevo");
    await expect(invokeUserManagement(body)).resolves.toBe(unauthorized);
    expect(invoke).toHaveBeenCalledTimes(2);
    expect(freshSession).toHaveBeenCalledTimes(2);
  });

  it.each([null, "rechazado"])("no reenvía un token ausente o rechazado (%s)", async (token) => {
    invoke.mockResolvedValue(unauthorized);
    freshSession.mockResolvedValueOnce("rechazado").mockResolvedValueOnce(token);
    await expect(invokeUserManagement(body)).resolves.toBe(unauthorized);
    expect(invoke).toHaveBeenCalledTimes(1);
  });

  it("no reintenta errores diferentes a 401", async () => {
    const error = { data: null, error: { context: { status: 403 } } };
    invoke.mockResolvedValue(error);
    await expect(invokeUserManagement(body)).resolves.toBe(error);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(freshSession).toHaveBeenCalledTimes(1);
  });

  it("si no hay token deja al SDK adjuntar la sesión y no reintenta", async () => {
    freshSession.mockResolvedValue(null);
    invoke.mockResolvedValue(unauthorized);
    await expect(invokeUserManagement(body)).resolves.toBe(unauthorized);
    expect(invoke).toHaveBeenCalledExactlyOnceWith("user-management", { body });
  });

  it("si falla la lectura de sesión conserva el fallback del SDK", async () => {
    freshSession.mockRejectedValue(new Error("sesión no disponible"));
    await expect(invokeUserManagement(body)).resolves.toBe(ok);
    expect(invoke).toHaveBeenCalledExactlyOnceWith("user-management", { body });
  });
});
