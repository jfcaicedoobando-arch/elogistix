import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchDashboardEjecutivoFacturacion } from "../dashboardEjecutivo";

const HOY = new Date(Date.UTC(2026, 5, 15)); // junio 2026

const TENDENCIA = [
  { mes: "2026-01", facturado_mxn: 0, cobrado_mxn: 0 },
  { mes: "2026-02", facturado_mxn: 0, cobrado_mxn: 0 },
  { mes: "2026-03", facturado_mxn: 0, cobrado_mxn: 0 },
  { mes: "2026-04", facturado_mxn: 0, cobrado_mxn: 0 },
  { mes: "2026-05", facturado_mxn: 500, cobrado_mxn: 0 },
  { mes: "2026-06", facturado_mxn: 1000, cobrado_mxn: 700 },
];

describe("fetchDashboardEjecutivoFacturacion (RPC C3c)", () => {
  beforeEach(() => {
    mock.resetResults();
    mock.rpcCalls.length = 0;
  });

  it("mapea la tendencia y el mes en curso desde la RPC", async () => {
    mock.setRpcResult("dashboard_facturacion_kpis", {
      data: { tendencia: TENDENCIA, facturas_sin_tc: 0 },
      error: null,
    });
    const res = await fetchDashboardEjecutivoFacturacion("org", null, HOY);
    expect(res.tendencia).toHaveLength(6);
    expect(res.facturado_mes_mxn).toBe(1000);
    expect(res.cobrado_mes_mxn).toBe(700);
    expect(res.facturas_sin_tc).toBe(0);
    expect(res.tendencia[res.tendencia.length - 1].mes).toBe("2026-06");
  });

  it("agrega en el servidor (una sola llamada RPC, sin traer filas)", async () => {
    mock.setRpcResult("dashboard_facturacion_kpis", {
      data: { tendencia: TENDENCIA, facturas_sin_tc: 0 },
      error: null,
    });
    await fetchDashboardEjecutivoFacturacion("org", null, HOY);
    expect(mock.rpcCalls).toHaveLength(1);
    expect(mock.rpcCalls[0].fn).toBe("dashboard_facturacion_kpis");
    expect(mock.tableCalls).toHaveLength(0);
  });

  it("propaga el fallback USD a la RPC", async () => {
    mock.setRpcResult("dashboard_facturacion_kpis", {
      data: { tendencia: [], facturas_sin_tc: 0 },
      error: null,
    });
    await fetchDashboardEjecutivoFacturacion("org", 19, HOY);
    expect(mock.rpcCalls[0].args).toMatchObject({ p_meses: 6, p_fallback_usd: 19 });
  });

  it("expone facturas_sin_tc que reporta la RPC", async () => {
    mock.setRpcResult("dashboard_facturacion_kpis", {
      data: { tendencia: TENDENCIA, facturas_sin_tc: 3 },
      error: null,
    });
    const res = await fetchDashboardEjecutivoFacturacion("org", null, HOY);
    expect(res.facturas_sin_tc).toBe(3);
  });

  it("devuelve ceros cuando la RPC no trae datos", async () => {
    mock.setRpcResult("dashboard_facturacion_kpis", { data: null, error: null });
    const res = await fetchDashboardEjecutivoFacturacion(null, null, HOY);
    expect(res).toEqual({
      facturado_mes_mxn: 0,
      cobrado_mes_mxn: 0,
      tendencia: [],
      facturas_sin_tc: 0,
    });
  });

  it("propaga el error de la RPC dashboard_facturacion_kpis", async () => {
    mock.setRpcResult("dashboard_facturacion_kpis", { data: null, error: new Error("F") });
    await expect(fetchDashboardEjecutivoFacturacion("org", null, HOY)).rejects.toThrow("F");
  });
});
