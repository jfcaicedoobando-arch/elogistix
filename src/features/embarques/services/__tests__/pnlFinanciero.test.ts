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

  it("audit129 preserves incomplete costs and null profit instead of fabricating 100%", async () => {
    rpc.mockResolvedValue({ data: { estado_costos: "incompleto", utilidad_mxn: null,
      notas_credito_sin_base: 1, venta: { real_mxn: 150 }, costo: { real_mxn: 0 } }, error: null });
    const result = await fetchPnlEmbarque("e1");
    expect(result.estado_costos).toBe("incompleto");
    expect(result.utilidad_mxn).toBeNull();
    expect(result.notas_credito_sin_base).toBe(1);
  });

  it("audit130 conserva la advertencia de reparto provisional sin inventar utilidad", async () => {
    rpc.mockResolvedValue({ data: { estado_costos: "incompleto", utilidad_mxn: null,
      facturas_sobreasignadas: 1, costo_sobreasignado_mxn: 20 }, error: null });
    const result = await fetchPnlEmbarque("e1");
    expect(result.facturas_sobreasignadas).toBe(1);
    expect(result.costo_sobreasignado_mxn).toBe(20);
    expect(result.utilidad_mxn).toBeNull();
  });

  it("propaga el error de la RPC (no lo silencia)", async () => {
    rpc.mockResolvedValue({ data: null, error: new Error("permission denied") });
    await expect(fetchPnlEmbarque("e1")).rejects.toThrow("permission denied");
  });

  it("retorna el payload tal cual lo envía la RPC", async () => {
    const payload = {
      embarque_id: "e1",
      estado_costos: "completo",
      utilidad_mxn: 330,
      notas_credito_sin_base: 0,
      costo_sin_asignar_mxn: 0,
      facturas_sobreasignadas: 0,
      costo_sobreasignado_mxn: 0,
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
