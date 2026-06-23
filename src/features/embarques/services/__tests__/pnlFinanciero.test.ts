/**
 * 13.116.0 (Sprint C) — Tests del wrapper `fetchPnlEmbarque`.
 * El cálculo real vive en la RPC `pnl_financiero_embarque` (SQL). Aquí
 * verificamos que el wrapper propaga errores y pasa el embarqueId
 * correctamente — bug pasado: se pasaba `_id` en vez de `_embarque_id`
 * y los tests con mocks laxos no lo detectaron.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { rpc: (...args: unknown[]) => rpc(...args) },
}));

import { fetchPnlEmbarque } from "../pnlFinanciero";

describe("fetchPnlEmbarque", () => {
  beforeEach(() => rpc.mockReset());

  it("invoca la RPC con el nombre y parámetro EXACTOS", async () => {
    rpc.mockResolvedValue({ data: { embarque_id: "e1" }, error: null });
    await fetchPnlEmbarque("e1");
    // Si alguien renombra el parámetro en el SQL, este test grita.
    expect(rpc).toHaveBeenCalledWith("pnl_financiero_embarque", { _embarque_id: "e1" });
  });

  it("propaga el error de la RPC (no lo silencia)", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("permission denied") });
    await expect(fetchPnlEmbarque("e1")).rejects.toThrow("permission denied");
  });

  it("retorna el payload tal cual lo envía la RPC", async () => {
    const payload = {
      embarque_id: "e1",
      tipo_cambio_usd: 17.5,
      tipo_cambio_eur: 19.0,
      venta: { presupuestada_mxn: 1000, real_mxn: 950, pdte_cobro_mxn: 50 },
      costo: { presupuestado_mxn: 600, real_mxn: 620, pdte_pago_mxn: 100 },
      por_concepto: [],
      por_concepto_costo: [],
      por_proveedor: [],
    };
    rpc.mockResolvedValue({ data: payload, error: null });
    const res = await fetchPnlEmbarque("e1");
    expect(res).toEqual(payload);
  });
});
