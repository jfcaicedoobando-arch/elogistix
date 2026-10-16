import { beforeEach, describe, expect, it, vi } from "vitest";
const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
import { pasarAProspecto } from "../estadoEmpresaCrm";

beforeEach(() => rpc.mockReset());
describe("pasarAProspecto", () => {
  it.each([false, true])("devuelve la oportunidad del RPC, incluido el reintento idempotente %s", async (sin_cambios) => {
    rpc.mockResolvedValue({ data: { oportunidad_id: "op", sin_cambios }, error: null });
    await expect(pasarAProspecto("empresa")).resolves.toBe("op");
    expect(rpc).toHaveBeenCalledExactlyOnceWith("crm_empresa_pasar_a_prospecto", { p_empresa_id: "empresa" });
  });
  it.each([
    ["LC_CRM_PROSPECTO_NO_AUTORIZADO", "creadas por ti"],
    ["LC_CRM_PROSPECTO_VINCULO_INVALIDO", "Revisa sus vínculos"],
    ["LC_CRM_EMPRESA_YA_CLIENTE", "ya es cliente"],
  ])("explica rechazo %s y conserva su causa", async (codigo, mensaje) => {
    const error = new Error(codigo);
    rpc.mockResolvedValue({ data: null, error });
    const fallo = await pasarAProspecto("empresa").catch((e: Error) => e);
    expect(fallo).toBeInstanceOf(Error);
    expect((fallo as Error).message).toContain(mensaje);
    expect((fallo as Error).cause).toBe(error);
    expect(rpc).toHaveBeenCalledOnce();
  });
  it("propaga un error no reconocido sin ocultarlo", async () => {
    const error = new Error("red no disponible");
    rpc.mockResolvedValue({ data: null, error });
    await expect(pasarAProspecto("empresa")).rejects.toBe(error);
  });
});
