import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchResumenTesoreria, fetchSaldosCuentas } from "../resumen";

describe("resumen tesoreria service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  it("fetchSaldosCuentas calcula saldos por cuenta", async () => {
    mock.setTableResult("cuentas_bancarias", { data: [{ id: "c1", alias: "A", banco: "B", moneda: "MXN", saldo_inicial: 1000 }], error: null });
    // P4: ahora leemos la vista agregada `v_saldos_cuentas_bancarias`.
    mock.setTableResult("v_saldos_cuentas_bancarias", {
      data: [{ cuenta_bancaria_id: "c1", total_abonos: 200, total_cargos: 100 }],
      error: null,
    });

    const cuentas = await fetchSaldosCuentas();
    expect(cuentas.length).toBe(1);
    expect(cuentas[0].saldo).toBe(1100);
  });

  it("propaga error de supabase al leer cuentas_bancarias", async () => {
    mock.setTableResult("cuentas_bancarias", { data: null, error: new Error("db error") });
    await expect(fetchSaldosCuentas()).rejects.toThrow("db error");
  });

  it("fetchResumenTesoreria compone cuentas + cobranza/cxp inyectados", async () => {
    mock.setTableResult("cuentas_bancarias", { data: [{ id: "c1", alias: "A", banco: "B", moneda: "MXN", saldo_inicial: 500 }], error: null });
    mock.setTableResult("v_saldos_cuentas_bancarias", { data: [], error: null });
    const res = await fetchResumenTesoreria({ cobranza: [], cxp: [] });
    expect(res.cuentas).toHaveLength(1);
    expect(res.top_deudores).toEqual([]);
    expect(res.top_acreedores).toEqual([]);
  });
});
