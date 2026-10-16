import { beforeEach, describe, expect, it, vi } from "vitest";
import { extraerTarifasCorreo } from "../extraerTarifasCorreo";

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { functions: { invoke } } }));

const correo = {
  proveedor: "longsail", asunto: "Tarifas sintéticas", fecha: "2026-10-14",
  textoPlano: "Contenido sintético", xlsxBase64: null, xlsxNombre: null,
};

beforeEach(() => { invoke.mockReset(); });

describe("extraerTarifasCorreo", () => {
  it("conserva la organización y valida los cuatro proveedores y sus errores parciales", async () => {
    const correos = ["longsail", "golden", "oriental", "rainbow"].map((proveedor) => ({
      ...correo, proveedor, error: "Sin correos recientes de este proveedor",
    }));
    invoke.mockResolvedValue({ data: { correos }, error: null });
    await expect(extraerTarifasCorreo("org-a")).resolves.toEqual(correos);
    expect(invoke).toHaveBeenCalledExactlyOnceWith("extraer-tarifas-correo", { body: { organizationId: "org-a" } });
  });

  it("acepta el lote vacío y los adjuntos de texto", async () => {
    invoke.mockResolvedValueOnce({ data: { correos: [] }, error: null });
    await expect(extraerTarifasCorreo("org-a")).resolves.toEqual([]);
    const adjunto = { ...correo, proveedor: "rainbow", xlsxBase64: "c2ludGV0aWNv", xlsxNombre: "tarifas.xlsx" };
    invoke.mockResolvedValueOnce({ data: { correos: [adjunto] }, error: null });
    await expect(extraerTarifasCorreo("org-a")).resolves.toEqual([adjunto]);
  });

  it.each([new Error("fallo de transporte"), { message: "acceso denegado" }])("propaga el error de invoke sin tratarlo como un lote vacío", async (error) => {
    invoke.mockResolvedValue({ data: { correos: [] }, error });
    await expect(extraerTarifasCorreo("org-a")).rejects.toBe(error);
  });

  it("propaga el rechazo de la promesa", async () => {
    const error = new Error("conexión interrumpida");
    invoke.mockRejectedValue(error);
    await expect(extraerTarifasCorreo("org-a")).rejects.toBe(error);
  });

  it.each([
    null, undefined, {}, [], { correos: null }, { correos: {} }, { correos: [null] },
    { correos: [{ ...correo, proveedor: "otro" }] },
    { correos: [{ ...correo, proveedor: "__proto__" }] },
    { correos: [{ ...correo, asunto: 1 }] },
    { correos: [{ ...correo, fecha: null }] },
    { correos: [{ ...correo, textoPlano: [] }] },
    { correos: [{ ...correo, xlsxBase64: 1 }] },
    { correos: [{ ...correo, xlsxNombre: false }] },
    { correos: [{ ...correo, error: {} }] },
    { correos: [{ proveedor: "longsail" }] },
    { correos: [correo, { ...correo, textoPlano: 5 }] },
  ])("rechaza una respuesta inválida completa sin devolver filas parciales (%#)", async (data) => {
    invoke.mockResolvedValue({ data, error: null });
    await expect(extraerTarifasCorreo("org-a")).rejects.toThrow("El servicio de extracción devolvió una respuesta inválida");
  });

  it.each(["", "   "])("rechaza una organización vacía antes de invocar (%#)", async (organizationId) => {
    await expect(extraerTarifasCorreo(organizationId)).rejects.toThrow("Falta la organización");
    expect(invoke).not.toHaveBeenCalled();
  });
});
