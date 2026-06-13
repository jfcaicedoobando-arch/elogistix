import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchFlujoProyectado } from "../flujoProyectado";

describe("flujoProyectado service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  it("fetchFlujoProyectado retorna estructura base con semanas dentro de la ventana", async () => {
    mock.setTableResult("liquidaciones_comision", { data: [], error: null });
    const res = await fetchFlujoProyectado({ cuentas: [], cobranza: [], cxp: [], dias: 30 });
    expect(typeof res.saldo_inicial_mxn).toBe("number");
    expect(res.semanas.length).toBeGreaterThanOrEqual(4);
    expect(res.semanas.length).toBeLessThanOrEqual(6);
    expect(res.total_entradas_mxn).toBe(0);
    expect(res.total_salidas_mxn).toBe(0);
    expect(res.alertas_negativas).toBe(0);
  });

  it("error en liquidaciones_comision se propaga", async () => {
    mock.setTableResult("liquidaciones_comision", { data: null, error: new Error("db error") });
    await expect(
      fetchFlujoProyectado({ cuentas: [], cobranza: [], cxp: [], dias: 30 }),
    ).rejects.toThrow("db error");
  });
});
