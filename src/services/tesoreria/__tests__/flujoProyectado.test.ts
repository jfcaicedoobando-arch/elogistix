import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

// Mocks de dependencias de servicios
vi.mock("@/services/facturas", () => ({ fetchCobranza: vi.fn().mockResolvedValue([]) }));
vi.mock("@/services/cxp", () => ({ fetchFacturasCxP: vi.fn().mockResolvedValue([]) }));
vi.mock("../resumen", () => ({ fetchResumenTesoreria: vi.fn().mockResolvedValue({ cuentas: [] }) }));

import { fetchFlujoProyectado } from "../flujoProyectado";

describe("flujoProyectado service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  it("fetchFlujoProyectado retorna estructura base con semanas dentro de la ventana", async () => {
    mock.setTableResult("liquidaciones_comision", { data: [], error: null });
    const res = await fetchFlujoProyectado(30);
    expect(typeof res.saldo_inicial_mxn).toBe("number");
    expect(res.semanas.length).toBeGreaterThanOrEqual(4);
    expect(res.semanas.length).toBeLessThanOrEqual(6);
    // Sin entradas/salidas mockeadas, todos los acumulados son 0.
    expect(res.total_entradas_mxn).toBe(0);
    expect(res.total_salidas_mxn).toBe(0);
    expect(res.alertas_negativas).toBe(0);
  });

  it("error en liquidaciones_comision NO contamina total_salidas_mxn (se traga silenciosamente)", async () => {
    mock.setTableResult("liquidaciones_comision", { data: null, error: new Error("db error") });
    const res = await fetchFlujoProyectado(30);
    // El .then((r) => r.data ?? []) del service implementa fallback silencioso.
    expect(res.total_salidas_mxn).toBe(0);
    expect(res.semanas.every((s) => s.salidas_mxn === 0)).toBe(true);
  });
});
