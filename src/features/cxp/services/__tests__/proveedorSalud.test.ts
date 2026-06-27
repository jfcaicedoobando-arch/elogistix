import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchProveedorSalud } from "../proveedorSalud";

describe("fetchProveedorSalud", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  it("invoca RPC con proveedorId y mapea campos", async () => {
    mock.setRpcResult("proveedor_salud", {
      data: {
        facturas_12m: 12,
        monto_12m: 50000,
        saldo_actual: 2000,
        dias_promedio_pago: 25,
        pct_pagadas_a_tiempo: 0.8,
        notas_credito_count: 2,
        notas_credito_monto: 300,
        embarques_activos: 4,
        mensual: [{ mes: "2026-01", monto: "100", facturas: "2" }],
      },
      error: null,
    });
    const r = await fetchProveedorSalud("p1");
    expect(r.facturas_12m).toBe(12);
    expect(r.saldo_actual).toBe(2000);
    expect(r.dias_promedio_pago).toBe(25);
    expect(r.pct_pagadas_a_tiempo).toBeCloseTo(0.8);
    expect(r.mensual).toEqual([{ mes: "2026-01", monto: 100, facturas: 2 }]);
  });

  it("usa defaults cuando los campos son null/undefined", async () => {
    mock.setRpcResult("proveedor_salud", { data: {}, error: null });
    const r = await fetchProveedorSalud("p1");
    expect(r).toEqual({
      facturas_12m: 0,
      monto_12m: 0,
      saldo_actual: 0,
      dias_promedio_pago: null,
      pct_pagadas_a_tiempo: null,
      notas_credito_count: 0,
      notas_credito_monto: 0,
      embarques_activos: 0,
      mensual: [],
    });
  });

  it("data null → defaults", async () => {
    mock.setRpcResult("proveedor_salud", { data: null, error: null });
    const r = await fetchProveedorSalud("p1");
    expect(r.facturas_12m).toBe(0);
    expect(r.mensual).toEqual([]);
  });

  it("conserva null explícito en métricas opcionales", async () => {
    mock.setRpcResult("proveedor_salud", {
      data: { dias_promedio_pago: null, pct_pagadas_a_tiempo: null },
      error: null,
    });
    const r = await fetchProveedorSalud("p1");
    expect(r.dias_promedio_pago).toBeNull();
    expect(r.pct_pagadas_a_tiempo).toBeNull();
  });

  it("ignora mensual cuando no es array", async () => {
    mock.setRpcResult("proveedor_salud", { data: { mensual: "x" }, error: null });
    const r = await fetchProveedorSalud("p1");
    expect(r.mensual).toEqual([]);
  });

  it("[proveedorSalud] propaga error de Supabase", async () => {
    mock.setRpcResult("proveedor_salud", { data: null, error: { message: "boom" } });
    await expect(fetchProveedorSalud("p1")).rejects.toMatchObject({ message: "boom" });
  });
});
