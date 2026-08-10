/**
 * Ola 4 · N15: un pago ya ligado a un movimiento bancario VIVO no debe
 * sugerirse de nuevo (evita ofrecer un match imposible en la auto-masiva).
 * Si el movimiento que lo tenía ligado terminó en papelera (deleted_at), el
 * pago vuelve a estar disponible.
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

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.resetResults();
});

describe("sugerirCandidatos · pagos ya vinculados (Ola 4 · N15)", () => {
  it("no sugiere un pago a proveedor ya ligado a un movimiento vivo", async () => {
    mock.setTableResult("pagos_proveedor", {
      data: [
        {
          id: "p1",
          fecha_pago: "2026-06-10",
          monto: 1000,
          moneda: "MXN",
          referencia: "R1",
          proveedor_facturas: null,
        },
      ],
      error: null,
    });
    mock.setTableResult("bbva_movimientos", {
      data: [{ pago_factura_id: null, pago_proveedor_id: "p1" }],
      error: null,
    });
    const res = await sugerirCandidatos(mov({ cargo: 1000, abono: 0, fecha: "2026-06-10" }));
    expect(res).toEqual([]);
    const call = mock.tableCalls.find((c) => c.table === "bbva_movimientos");
    expect(call?.ops).toContain("is");
    expect(call?.opArgs).toContainEqual(["deleted_at", null]);
  });

  it("sí sugiere el pago si el movimiento que lo tenía está en papelera", async () => {
    mock.setTableResult("pagos_proveedor", {
      data: [
        {
          id: "p1",
          fecha_pago: "2026-06-10",
          monto: 1000,
          moneda: "MXN",
          referencia: "R1",
          proveedor_facturas: null,
        },
      ],
      error: null,
    });
    // El filtro .is("deleted_at", null) del servicio ya excluye a los movimientos
    // en papelera; el mock simula que la consulta no devuelve ningún vínculo vivo.
    mock.setTableResult("bbva_movimientos", { data: [], error: null });
    const res = await sugerirCandidatos(mov({ cargo: 1000, abono: 0, fecha: "2026-06-10" }));
    expect(res).toHaveLength(1);
    expect(res[0].pago_id).toBe("p1");
  });

  it("no consulta bbva_movimientos cuando no hay candidatos por monto/fecha", async () => {
    mock.setTableResult("pagos_factura", { data: [], error: null });
    await sugerirCandidatos(mov({ cargo: 0, abono: 500, fecha: "2026-06-10" }));
    expect(mock.tableCalls.some((c) => c.table === "bbva_movimientos")).toBe(false);
  });
});
