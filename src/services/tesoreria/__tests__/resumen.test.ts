import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

vi.mock("@/services/facturas", () => ({ fetchCobranza: vi.fn().mockResolvedValue([]) }));
vi.mock("@/services/cxp", () => ({ fetchFacturasCxP: vi.fn().mockResolvedValue([]) }));

import { fetchResumenTesoreria } from "../resumen";

describe("resumen tesoreria service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  it("fetchResumenTesoreria calcula saldos por cuenta", async () => {
    mock.setTableResult("cuentas_bancarias", { data: [{ id: "c1", alias: "A", banco: "B", moneda: "MXN", saldo_inicial: 1000 }], error: null });
    mock.setTableResult("bbva_movimientos", { data: [{ cargo: 100, abono: 200 }], error: null });
    
    const res = await fetchResumenTesoreria();
    expect(res.cuentas.length).toBe(1);
    expect(res.cuentas[0].saldo).toBe(1100);
  });

  it("propaga error de supabase al leer cuentas_bancarias", async () => {
    mock.setTableResult("cuentas_bancarias", { data: null, error: new Error("db error") });
    await expect(fetchResumenTesoreria()).rejects.toThrow("db error");
  });
});
