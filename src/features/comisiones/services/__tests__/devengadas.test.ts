import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchComisionesDevengadas, calcularKPIsComisiones } from "../devengadas";

describe("devengadas service", () => {
  // Sprint 2.5 (13.115.0): fake timers fijos a las 12:00 del 15 de junio.
  // Antes `new Date()` real causaba flakiness en KPIs "mes actual" a las 23:59.
  beforeEach(() => {
    mock.tableCalls.length = 0;
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetchComisionesDevengadas mapea embeds de facturas", async () => {
    mock.setTableResult("comisiones_devengadas", { 
      data: [{ 
        id: "c1", comision_mxn: 500,
        facturas: { numero: "F123", cliente_nombre: "ACME" }
      }], 
      error: null 
    });
    const res = await fetchComisionesDevengadas();
    expect(res[0].factura_numero).toBe("F123");
    expect(res[0].cliente_nombre).toBe("ACME");
  });

  it("calcularKPIsComisiones suma segun estado (con reloj fijo)", () => {
    const ahora = new Date("2025-06-15T12:00:00.000Z").toISOString();
    const items = [
      { comision_mxn: 100, estado: "Devengada", created_at: ahora },
      { comision_mxn: 200, estado: "Liquidada", created_at: ahora }
    ] as any;
    const kpis = calcularKPIsComisiones(items);
    expect(kpis.pendiente_liquidar_mxn).toBe(100);
    expect(kpis.liquidado_mes_mxn).toBe(200);
  });

  it("lanza error si falla la query", async () => {
    mock.setTableResult("comisiones_devengadas", { data: null, error: new Error("fail") });
    await expect(fetchComisionesDevengadas()).rejects.toThrow("fail");
  });
});
