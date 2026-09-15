/**
 * MNY-02 — al desconciliar, el movimiento no debe conservar ningún vínculo con
 * el pago anterior (individual, en lote o anticipo).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("../conciliacionBitacora", () => ({
  bitacoraDesconciliarMovimiento: vi.fn(),
  bitacoraIgnorarMovimiento: vi.fn(),
}));

import { desconciliarMovimiento } from "../conciliacionEstados";

describe("desconciliarMovimiento (MNY-02)", () => {
  beforeEach(() => mock.resetResults());

  it("limpia todos los vínculos bancarios y deja el movimiento Pendiente", async () => {
    mock.setTableResult("bbva_movimientos", { data: [{ id: "m1" }], error: null });

    await desconciliarMovimiento("m1");

    // SAFE-CAST: el mock guarda el payload del update tal como se envió.
    const payload = (mock.getMutationPayload("bbva_movimientos", "update") ?? {}) as Record<
      string,
      unknown
    >;
    expect(payload).toMatchObject({
      pago_factura_id: null,
      pago_factura_lote_id: null,
      pago_proveedor_id: null,
      pago_proveedor_lote_id: null,
      anticipo_proveedor_id: null,
      estado_conciliacion: "Pendiente",
    });
  });
});
