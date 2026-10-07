import { setAuthSnapshot } from "@/lib/auth/authSnapshot";
import { captureAuthOperationScope, syncActiveOrganizationScope } from "@/lib/auth/authOperationScope";
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

  it("conserva la empresa explícita del destino sin enviar identidad de actor", async () => {
    await registrarActividad({ modulo: "facturacion", accion: "actualizar_datos_timbrado_factura", entidadId: "f1", organizationId: "org1" });
    expect(supabase.rpc).toHaveBeenCalledWith("registrar_bitacora", expect.objectContaining({ p_organization_id: "org1", p_entidad_id: "f1" }));
    const args = vi.mocked(supabase.rpc).mock.calls[0][1];
    expect(args).not.toHaveProperty("p_usuario_id");
  });

  it("un caller sin destino explícito conserva su contrato anterior", async () => {
    await registrarActividad({ modulo: "cxp", accion: "crear" });
    const args = vi.mocked(supabase.rpc).mock.calls[0][1];
    expect(args).not.toHaveProperty("p_organization_id");
  });

  it("una sesión que cambia mientras getSession espera no registra la operación anterior", async () => {
    const usuario = (userId: string) => {
      setAuthSnapshot({ userId, organizationId: "org1", role: "admin", effectiveRole: "admin", email: null, organizationName: null });
      syncActiveOrganizationScope({ userId, organizationId: "org1" });
    };
    usuario("u1");
    const session = (await supabase.auth.getSession()).data.session!;
    let resolve!: (value: Awaited<ReturnType<typeof supabase.auth.getSession>>) => void;
    vi.mocked(supabase.auth.getSession).mockImplementationOnce(() => new Promise((ok) => { resolve = ok; }));
    const pending = registrarActividad({ modulo: "facturacion", accion: "autosave", organizationId: "org1", authScope: captureAuthOperationScope() });
    usuario("u2"); resolve({ data: { session: { ...session, user: { ...session.user, id: "u2" } } }, error: null });
    await pending; expect(supabase.rpc).not.toHaveBeenCalled();
  });

});
