import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchDashboardEjecutivoFacturacion } from "../dashboardEjecutivo";

const HOY = new Date(Date.UTC(2026, 5, 15)); // junio 2026

describe("fetchDashboardEjecutivoFacturacion", () => {
  beforeEach(() => { mock.tableCalls.length = 0; });

  it("genera 6 meses de tendencia y acumula MXN directo", async () => {
    mock.setTableResult("facturas", {
      data: [
        { fecha_emision: "2026-06-10", total: 1000, moneda: "MXN", tipo_cambio: null },
        { fecha_emision: "2026-05-10", total: 500, moneda: "MXN", tipo_cambio: null },
      ],
      error: null,
    });
    mock.setTableResult("pagos_factura", {
      data: [{ fecha_pago: "2026-06-12", monto_aplicado_factura: 700, tipo_cambio: null, moneda: "MXN" }],
      error: null,
    });
    const res = await fetchDashboardEjecutivoFacturacion("org", null, HOY);
    expect(res.tendencia).toHaveLength(6);
    expect(res.facturado_mes_mxn).toBe(1000);
    expect(res.cobrado_mes_mxn).toBe(700);
    expect(res.facturas_sin_tc).toBe(0);
    expect(res.tendencia[res.tendencia.length - 1].mes).toBe("2026-06");
  });

  it("convierte USD con tipo_cambio>1", async () => {
    mock.setTableResult("facturas", {
      data: [{ fecha_emision: "2026-06-01", total: 100, moneda: "USD", tipo_cambio: 20 }],
      error: null,
    });
    mock.setTableResult("pagos_factura", { data: [], error: null });
    const res = await fetchDashboardEjecutivoFacturacion("org", null, HOY);
    expect(res.facturado_mes_mxn).toBe(2000);
  });

  it("usa fallbackUsdMxn cuando tipo_cambio<=1", async () => {
    mock.setTableResult("facturas", {
      data: [{ fecha_emision: "2026-06-01", total: 100, moneda: "USD", tipo_cambio: 1 }],
      error: null,
    });
    mock.setTableResult("pagos_factura", { data: [], error: null });
    const res = await fetchDashboardEjecutivoFacturacion("org", 19, HOY);
    expect(res.facturado_mes_mxn).toBe(1900);
    expect(res.facturas_sin_tc).toBe(0);
  });

  it("cuenta facturas_sin_tc cuando USD sin TC ni fallback", async () => {
    mock.setTableResult("facturas", {
      data: [{ fecha_emision: "2026-06-05", total: 100, moneda: "USD", tipo_cambio: null }],
      error: null,
    });
    mock.setTableResult("pagos_factura", { data: [], error: null });
    const res = await fetchDashboardEjecutivoFacturacion("org", null, HOY);
    expect(res.facturado_mes_mxn).toBe(0);
    expect(res.facturas_sin_tc).toBe(1);
  });

  it("ignora filas fuera del rango de 6 meses", async () => {
    mock.setTableResult("facturas", {
      data: [{ fecha_emision: "2025-01-01", total: 9999, moneda: "MXN", tipo_cambio: null }],
      error: null,
    });
    mock.setTableResult("pagos_factura", { data: [], error: null });
    const res = await fetchDashboardEjecutivoFacturacion("org", null, HOY);
    expect(res.tendencia.every((m) => m.facturado_mxn === 0)).toBe(true);
  });

  it("propaga error de facturas", async () => {
    mock.setTableResult("facturas", { data: null, error: new Error("F") });
    mock.setTableResult("pagos_factura", { data: [], error: null });
    await expect(fetchDashboardEjecutivoFacturacion("org", null, HOY)).rejects.toThrow("F");
  });

  it("propaga error de pagos", async () => {
    mock.setTableResult("facturas", { data: [], error: null });
    mock.setTableResult("pagos_factura", { data: null, error: new Error("P") });
    await expect(fetchDashboardEjecutivoFacturacion("org", null, HOY)).rejects.toThrow("P");
  });

  it("omite filtro organization_id cuando es null", async () => {
    mock.setTableResult("facturas", { data: [], error: null });
    mock.setTableResult("pagos_factura", { data: [], error: null });
    await fetchDashboardEjecutivoFacturacion(null, null, HOY);
    for (const call of mock.tableCalls) {
      const eqIdx = call.ops.indexOf("eq");
      expect(eqIdx).toBe(-1);
    }
  });

  it("filtra facturas por estados facturados (excluye Borrador y Cancelada)", async () => {
    mock.setTableResult("facturas", { data: [], error: null });
    mock.setTableResult("pagos_factura", { data: [], error: null });
    await fetchDashboardEjecutivoFacturacion("org", null, HOY);
    const facturasCall = mock.tableCalls.find((c) => c.table === "facturas");
    expect(facturasCall).toBeDefined();
    const inIdx = facturasCall!.ops.indexOf("in");
    expect(inIdx).toBeGreaterThanOrEqual(0);
    // neq no debe usarse — antes filtraba solo Cancelada y dejaba pasar Borradores.
    expect(facturasCall!.ops.indexOf("neq")).toBe(-1);
    const [col, estados] = facturasCall!.opArgs[inIdx] as [string, string[]];
    expect(col).toBe("estado");
    expect(estados).toEqual(expect.arrayContaining(["Emitida", "Parcialmente pagada", "Vencida", "Pagada"]));
    expect(estados).not.toContain("Borrador");
    expect(estados).not.toContain("Cancelada");
  });
});
