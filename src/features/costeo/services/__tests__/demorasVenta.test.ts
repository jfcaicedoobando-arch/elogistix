import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchDemorasVenta, crearDemoraVenta, eliminarDemoraVenta } from "../demorasVenta";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("costeo/services/demorasVenta", () => {
  it("fetchDemorasVenta ordena por tipo_contenedor_id y desde_dia", async () => {
    mock.setTableResult("costeo_demoras_venta_tarifa", {
      data: [{ id: "d1", tipo_contenedor_id: "tc", desde_dia: 1, hasta_dia: 5, monto_por_dia_usd: 50 }],
      error: null,
    });
    const res = await fetchDemorasVenta();
    const call = mock.tableCalls.find((c) => c.table === "costeo_demoras_venta_tarifa");
    const orderCount = call?.ops.filter((o) => o === "order").length ?? 0;
    expect(orderCount).toBe(2);
    expect(res[0].desde_dia).toBe(1);
  });

  it("crearDemoraVenta inserta el payload tal cual", async () => {
    mock.setTableResult("costeo_demoras_venta_tarifa", { data: null, error: null });
    await crearDemoraVenta({
      tipo_contenedor_id: "tc",
      desde_dia: 1,
      hasta_dia: 5,
      monto_por_dia_usd: 75,
      vigente_desde: "2026-01-01",
      vigente_hasta: null,
      notas: null,
    });
    const payload = mock.getMutationPayload("costeo_demoras_venta_tarifa", "insert") as Record<string, unknown>;
    expect(payload.monto_por_dia_usd).toBe(75);
  });

  it("eliminarDemoraVenta usa delete().eq('id', ...)", async () => {
    mock.setTableResult("costeo_demoras_venta_tarifa", { data: null, error: null });
    await eliminarDemoraVenta("d1");
    const call = mock.tableCalls.find((c) => c.table === "costeo_demoras_venta_tarifa");
    expect(call?.ops).toContain("delete");
    expect(call?.ops).toContain("eq");
  });

  it("propaga errores de Supabase al consultar demoras de venta", async () => {
    mock.setTableResult("costeo_demoras_venta_tarifa", { data: null, error: { message: "rls" } });
    await expect(fetchDemorasVenta()).rejects.toThrow();
  });
});
