/**
 * Puerta de validación previa a capturar una factura desde el buzón CxP.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

import { validarCapturaEntrante } from "@/features/cxp/services/capturaEntrante";

describe("validarCapturaEntrante", () => {
  beforeEach(() => rpc.mockReset());

  it("normaliza una respuesta válida", async () => {
    rpc.mockResolvedValue({
      data: {
        ok: true,
        codigo: "OK",
        motivos: [],
        documento: { id: "d1", embarque_id: "e1" },
        proveedor: { id: "p1", nombre: "Naviera", rfc: "AAA010101AAA" },
        factura_duplicada: null,
      },
      error: null,
    });
    const res = await validarCapturaEntrante("d1");
    expect(res.ok).toBe(true);
    expect(res.proveedor?.nombre).toBe("Naviera");
    expect(rpc).toHaveBeenCalledWith("validar_captura_entrante", { p_documento_id: "d1" });
  });

  it("expone los motivos cuando la puerta cierra", async () => {
    rpc.mockResolvedValue({
      data: { ok: false, codigo: "LC_VALIDACION", motivos: ["CFDI ya capturado"], factura_duplicada: { id: "f1" } },
      error: null,
    });
    const res = await validarCapturaEntrante("d1");
    expect(res.ok).toBe(false);
    expect(res.motivos).toEqual(["CFDI ya capturado"]);
    expect(res.facturaDuplicada?.id).toBe("f1");
  });

  it("propaga errores de red o RLS", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("permission denied") });
    await expect(validarCapturaEntrante("d1")).rejects.toThrow("permission denied");
  });

  it("tolera una respuesta vacía", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    const res = await validarCapturaEntrante("d1");
    expect(res.ok).toBe(false);
    expect(res.documento).toBeNull();
  });
});
