/**
 * v13.495.0 — Regeneración del movimiento bancario faltante de un pago.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));
const registrarActividad = vi.fn().mockResolvedValue(undefined);
vi.mock("@/services/bitacora/registrar", () => ({
  registrarActividad: (...args: unknown[]) => registrarActividad(...args),
}));

import { regenerarMovimientoPagoProveedor } from "../pagoProveedorMovimientoRegenerar";

describe("regenerarMovimientoPagoProveedor", () => {
  beforeEach(() => {
    rpc.mockReset();
    registrarActividad.mockClear();
  });

  it("devuelve el id del movimiento creado y deja rastro en bitácora", async () => {
    rpc.mockResolvedValue({ data: "mov-1", error: null });
    const id = await regenerarMovimientoPagoProveedor("pago-1");
    expect(id).toBe("mov-1");
    expect(rpc).toHaveBeenCalledWith("regenerar_movimiento_pago_proveedor", {
      p_pago_id: "pago-1",
    });
    expect(registrarActividad).toHaveBeenCalledWith(
      expect.objectContaining({ modulo: "tesoreria", entidadId: "pago-1" }),
    );
  });

  it("propaga el rechazo de la RPC (por ejemplo, movimiento ya existente)", async () => {
    rpc.mockResolvedValue({
      data: null,
      error: { message: "LC_MOVIMIENTO_YA_EXISTE: ya tiene movimiento" },
    });
    await expect(regenerarMovimientoPagoProveedor("pago-2")).rejects.toMatchObject({
      message: expect.stringContaining("LC_MOVIMIENTO_YA_EXISTE"),
    });
    expect(registrarActividad).not.toHaveBeenCalled();
  });
});
