/**
 * MNY — Un pago a proveedor que pertenece a un lote CxP ya está representado
 * por el movimiento bancario del lote (`pago_proveedor_lote_id`). No debe
 * sugerirse otra vez como pago individual: el mismo egreso quedaría conciliado
 * dos veces. Si el movimiento del lote está en papelera, el pago vuelve a estar
 * disponible.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { sugerirCandidatos } from "../sugerirCandidatos";
import type { MovimientoBBVA } from "../conciliacion";

function mov(partial: Partial<MovimientoBBVA>): MovimientoBBVA {
  return partial as MovimientoBBVA;
}

const pagoEnLote = {
  id: "p1",
  fecha_pago: "2026-06-10",
  monto: 1000,
  moneda: "MXN",
  referencia: "R1",
  lote_id: "lote-1",
  proveedor_facturas: null,
};

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.resetResults();
});

describe("sugerirCandidatos · miembros de lote CxP (MNY)", () => {
  it("no sugiere el pago cuando el movimiento del lote sigue vivo", async () => {
    mock.setTableResult("pagos_proveedor", { data: [pagoEnLote], error: null });
    mock.setTableResult("bbva_movimientos", {
      data: [{ pago_factura_id: null, pago_proveedor_id: null, pago_proveedor_lote_id: "lote-1" }],
      error: null,
    });
    const res = await sugerirCandidatos(mov({ cargo: 1000, abono: 0, fecha: "2026-06-10" }), "MXN");
    expect(res).toEqual([]);
  });

  it("sí sugiere el pago si el movimiento del lote está en papelera", async () => {
    mock.setTableResult("pagos_proveedor", { data: [pagoEnLote], error: null });
    mock.setTableResult("bbva_movimientos", { data: [], error: null });
    const res = await sugerirCandidatos(mov({ cargo: 1000, abono: 0, fecha: "2026-06-10" }), "MXN");
    expect(res).toHaveLength(1);
    expect(res[0].pago_id).toBe("p1");
  });

  it("mantiene intactos los pagos individuales sin lote", async () => {
    mock.setTableResult("pagos_proveedor", {
      data: [{ ...pagoEnLote, lote_id: null }],
      error: null,
    });
    mock.setTableResult("bbva_movimientos", { data: [], error: null });
    const res = await sugerirCandidatos(mov({ cargo: 1000, abono: 0, fecha: "2026-06-10" }), "MXN");
    expect(res).toHaveLength(1);
  });
});
