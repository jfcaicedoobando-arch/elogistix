/**
 * `capturarFacturaEntrante`: cierre del ciclo del buzón CxP.
 *
 * v13.421.0 — El RPC es idempotente en BD (el trigger
 * `trg_cerrar_entrantes_por_uuid` puede haber cerrado ya el documento contra la
 * misma factura), por lo que llamarlo dos veces no debe lanzar error.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

import { capturarFacturaEntrante } from "@/features/cxp/services/facturasEntrantes";

describe("capturarFacturaEntrante", () => {
  beforeEach(() => rpc.mockReset());

  it("envía documento y factura al RPC", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await capturarFacturaEntrante("d1", "f1");
    expect(rpc).toHaveBeenCalledWith("capturar_factura_entrante", {
      p_documento_id: "d1",
      p_factura_id: "f1",
    });
  });

  it("no lanza al repetir la captura del mismo par documento/factura", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await capturarFacturaEntrante("d1", "f1");
    await expect(capturarFacturaEntrante("d1", "f1")).resolves.toBeUndefined();
  });

  it("propaga el conflicto cuando el documento ya está vinculado a otra factura", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: {
        code: "P0001",
        message: "LC_ESTADO_INVALIDO: el documento ya está vinculado a otra factura de proveedor",
      },
    });
    await expect(capturarFacturaEntrante("d1", "f2")).rejects.toMatchObject({
      code: "P0001",
    });
  });
});
