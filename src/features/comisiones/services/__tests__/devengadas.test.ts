import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchComisionesDevengadas, calcularKPIsComisiones } from "../devengadas";

describe("devengadas service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
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

  it("calcularKPIsComisiones suma segun estado", () => {
    const items = [
      { comision_mxn: 100, estado: "Devengada", created_at: new Date().toISOString() },
      { comision_mxn: 200, estado: "Liquidada", created_at: new Date().toISOString() }
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
