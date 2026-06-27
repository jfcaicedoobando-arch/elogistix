import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchComisionesDevengadas, calcularKPIsComisiones } from "../devengadas";

describe("devengadas service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.resetResults();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-06-15T12:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("fetchComisionesDevengadas: mapea embeds y aplica filtros", async () => {
    // 1. Success with filters
    mock.setTableResult("comisiones_devengadas", { 
      data: [{ 
        id: "c1", 
        created_at: "2025-06-10T00:00:00Z",
        monto_cobrado_mxn: "100",
        utilidad_prorrateada_mxn: "50",
        porcentaje_aplicado: "10",
        comision_mxn: "5",
        estado: "Devengada",
        facturas: { numero: "F1", cliente_nombre: "C1", expediente: "E1" }
      }, {
        id: "c2",
        created_at: "2025-05-10T00:00:00Z",
        estado: "Liquidada",
        facturas: null
      }], 
      error: null 
    });

    // Test with vendedora_id and estado
    const res = await fetchComisionesDevengadas({ vendedora_id: "v1", estado: "Devengada" });
    expect(res.length).toBe(2);
    expect(res[0].factura_numero).toBe("F1");
    expect(res[1].factura_numero).toBeNull();
    expect(mock.tableCalls[0].ops).toContain("eq"); // for vendedora_id
    expect(mock.tableCalls[0].ops).toContain("eq"); // for estado

    // Test with periodo filter
    const resPeriodo = await fetchComisionesDevengadas({ periodo: "2025-06" });
    expect(resPeriodo.length).toBe(1);
    expect(resPeriodo[0].id).toBe("c1");
  });

  it("fetchComisionesDevengadas: ignora filtros 'todas'/'todos'", async () => {
    mock.setTableResult("comisiones_devengadas", { data: [], error: null });
    await fetchComisionesDevengadas({ vendedora_id: "todas", estado: "todos" });
    expect(mock.tableCalls[0].ops).not.toContain("eq");
  });

  it("calcularKPIsComisiones: suma segun estado y mes", () => {
    const ahora = "2025-06-15T12:00:00Z";
    const mesPasado = "2025-05-15T12:00:00Z";
    const items = [
      { comision_mxn: 100, estado: "Devengada", created_at: ahora }, // dev +100, pend +100
      { comision_mxn: 200, estado: "Liquidada", created_at: ahora }, // dev +200, liq +200
      { comision_mxn: 50, estado: "Cancelada", created_at: ahora },  // ignored for dev
      { comision_mxn: 300, estado: "Devengada", created_at: mesPasado }, // pend +300, not in dev mes
      { comision_mxn: 400, estado: "Liquidada", created_at: mesPasado }, // not in dev mes, not in liq mes
    ] as any;
    const kpis = calcularKPIsComisiones(items);
    expect(kpis.devengado_mes_mxn).toBe(300);
    expect(kpis.pendiente_liquidar_mxn).toBe(400);
    expect(kpis.liquidado_mes_mxn).toBe(200);
  });

  it("lanza error si falla la query", async () => {
    mock.setTableResult("comisiones_devengadas", { data: null, error: new Error("fail") });
    await expect(fetchComisionesDevengadas()).rejects.toThrow("fail");
  });
});
