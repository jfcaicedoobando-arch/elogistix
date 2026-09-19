import { describe, it, expect, beforeEach, vi } from "vitest";
import { registrarActividad, MODULOS_BITACORA } from "../registrar";
import { supabase } from "@/integrations/supabase/client";

vi.mock("@/integrations/supabase/client", () => {
  const rpc = vi.fn().mockResolvedValue({ error: null });
  const session = { data: { session: { user: { id: "u-1", email: "a@b.com" } } } };
  const getSession = vi.fn().mockResolvedValue(session);
  return { supabase: { rpc, auth: { getSession } } };
});

describe("registrarActividad", () => {
  beforeEach(() => vi.clearAllMocks());

  // DEFECTO 8: la bitácora ya no se inserta desde el cliente; se registra por
  // la RPC `registrar_bitacora`, que deriva usuario_id/email del servidor.
  it("registra por la RPC con el shape correcto de parámetros", async () => {
    await registrarActividad({
      modulo: "cxp",
      accion: "crear",
      entidadId: "fp-1",
      entidadNombre: "FP-000001",
      detalles: { total: 100 },
    });
    const rpc = supabase.rpc as unknown as ReturnType<typeof vi.fn>;
    expect(rpc.mock.calls[0][0]).toBe("registrar_bitacora");
    expect(rpc.mock.calls[0][1]).toMatchObject({
      p_modulo: "cxp",
      p_accion: "crear",
      p_entidad_id: "fp-1",
      p_entidad_nombre: "FP-000001",
    });
    // El actor NO viaja desde el navegador: lo pone el servidor.
    expect(Object.keys(rpc.mock.calls[0][1] as object)).not.toContain("p_usuario_id");
  });

  it("no lanza si supabase falla", async () => {
    (supabase.rpc as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ error: { message: "boom" } });
    await expect(
      registrarActividad({ modulo: "cxp", accion: "crear" }),
    ).resolves.toBeUndefined();
  });

  // Ruido de CI: los dobles de Supabase de otras suites no exponen `auth`.
  // Antes eso lanzaba y dejaba 41 líneas `[bitacora] excepción:` en la salida.
  it("no intenta leer la sesión si el cliente no expone auth.getSession", async () => {
    const cliente = supabase as unknown as { auth?: unknown };
    const authOriginal = cliente.auth;
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    try {
      cliente.auth = undefined;
      await expect(
        registrarActividad({ modulo: "cxp", accion: "crear" }),
      ).resolves.toBeUndefined();
      expect(supabase.rpc).not.toHaveBeenCalled();
      expect(warn).not.toHaveBeenCalled();
    } finally {
      warn.mockRestore();
      cliente.auth = authOriginal;
    }
  });

  it("expone el catálogo público de módulos", () => {
    const valores = MODULOS_BITACORA.map((m) => m.valor);
    expect(valores).toContain("cxp");
    expect(valores).toContain("costeo");
    expect(valores).toContain("facturacion");
  });
});
