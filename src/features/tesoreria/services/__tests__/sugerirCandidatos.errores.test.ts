/**
 * MNY (item 7): un error de lectura NO puede verse como "sin coincidencias".
 * Si falla la consulta de pagos o la de vínculos existentes, el sugeridor
 * propaga el error para que la pantalla ofrezca reintentar.
 *
 * MNY (item 3): con más candidatos que el límite visual, el resultado se marca
 * truncado y la auto-conciliación no puede darlo por único.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { sugerirCandidatos, sugerirCandidatosDetalle, LIMITE_SUGERENCIAS } from "../sugerirCandidatos";
import type { MovimientoBBVA } from "../conciliacion";

function mov(partial: Partial<MovimientoBBVA>): MovimientoBBVA {
  return partial as MovimientoBBVA;
}

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.resetResults();
});

describe("sugerirCandidatos · errores de lectura", () => {
  it("propaga el error de la consulta de pagos", async () => {
    mock.setTableResult("pagos_proveedor", {
      data: null,
      error: { message: "boom pagos" },
    });
    await expect(
      sugerirCandidatos(mov({ cargo: 100, abono: 0, fecha: "2026-06-10" }), "MXN"),
    ).rejects.toThrow(/boom pagos/);
  });

  it("propaga el error de la consulta de pagos ya vinculados", async () => {
    mock.setTableResult("pagos_proveedor", {
      data: [
        {
          id: "p1", fecha_pago: "2026-06-10", monto: 100, moneda: "MXN",
          referencia: "R", proveedor_facturas: null,
        },
      ],
      error: null,
    });
    mock.setTableResult("bbva_movimientos", { data: null, error: { message: "boom vinculos" } });
    await expect(
      sugerirCandidatos(mov({ cargo: 100, abono: 0, fecha: "2026-06-10" }), "MXN"),
    ).rejects.toThrow(/boom vinculos/);
  });
});

describe("sugerirCandidatosDetalle · ambigüedad por exceso de candidatos", () => {
  it("marca truncado cuando hay más candidatos que el límite", async () => {
    const filas = Array.from({ length: LIMITE_SUGERENCIAS + 1 }, (_, i) => ({
      id: `p${i}`,
      fecha_pago: "2026-06-10",
      monto: 100,
      moneda: "MXN",
      referencia: "R",
      proveedor_facturas: null,
    }));
    mock.setTableResult("pagos_proveedor", { data: filas, error: null });
    mock.setTableResult("bbva_movimientos", { data: [], error: null });
    const res = await sugerirCandidatosDetalle(
      mov({ cargo: 100, abono: 0, fecha: "2026-06-10" }),
      "MXN",
    );
    expect(res.truncado).toBe(true);
    expect(res.candidatos.length).toBe(LIMITE_SUGERENCIAS);
  });
});
