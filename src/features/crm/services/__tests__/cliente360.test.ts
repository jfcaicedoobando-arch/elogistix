import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/features/crm/domain/cliente360", () => ({
  computeCliente360Totals: vi.fn(() => [{ moneda: "MXN", totalAbierto: 1000, totalGanado: 500 }]),
}));

import { fetchCliente360 } from "@/features/crm/services/cliente360";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("services/crm/cliente360", () => {
  function seedHappy() {
    mock.setTableResult("crm_oportunidades", {
      data: [{ id: "o1", nombre: "n", etapa_id: "e1", monto_estimado: 1000, valor_real: null, moneda: "MXN", probabilidad: 50, fecha_estimada_cierre: null, created_at: "x", vendedor_email: "v@e" }],
      error: null,
    });
    mock.setTableResult("cotizaciones", { data: [{ id: "c1", folio: "F", estado: "Enviada", subtotal: 100, created_at: "x" }], error: null });
    mock.setTableResult("embarques", { data: [{ id: "e1", expediente: "EX", estado: "En tránsito", created_at: "x" }], error: null });
    mock.setTableResult("crm_etapas_pipeline", { data: [{ id: "e1", tipo: "abierta" }], error: null });
  }

  it("fetchCliente360 ensambla resumen", async () => {
    seedHappy();
    const r = await fetchCliente360("cli-1");
    expect(r.oportunidades).toHaveLength(1);
    expect(r.ultimaCotizacion?.folio).toBe("F");
    expect(r.ultimoEmbarque?.expediente).toBe("EX");
    expect(r.totales).toEqual([{ moneda: "MXN", totalAbierto: 1000, totalGanado: 500 }]);
  });

  it("fetchCliente360 devuelve ultimaCotizacion null cuando no hay", async () => {
    seedHappy();
    mock.setTableResult("cotizaciones", { data: [], error: null });
    const r = await fetchCliente360("cli-1");
    expect(r.ultimaCotizacion).toBeNull();
  });

  it("fetchCliente360 devuelve ultimoEmbarque null cuando no hay", async () => {
    seedHappy();
    mock.setTableResult("embarques", { data: [], error: null });
    const r = await fetchCliente360("cli-1");
    expect(r.ultimoEmbarque).toBeNull();
  });

  it("fetchCliente360 propaga error de oportunidades", async () => {
    seedHappy();
    mock.setTableResult("crm_oportunidades", { data: null, error: { message: "x" } });
    await expect(fetchCliente360("cli-1")).rejects.toThrow();
  });

  it("fetchCliente360 propaga error de cotizaciones", async () => {
    seedHappy();
    mock.setTableResult("cotizaciones", { data: null, error: { message: "x" } });
    await expect(fetchCliente360("cli-1")).rejects.toThrow();
  });

  it("fetchCliente360 propaga error de embarques", async () => {
    seedHappy();
    mock.setTableResult("embarques", { data: null, error: { message: "x" } });
    await expect(fetchCliente360("cli-1")).rejects.toThrow();
  });

  it("fetchCliente360 propaga error de etapas", async () => {
    seedHappy();
    mock.setTableResult("crm_etapas_pipeline", { data: null, error: { message: "x" } });
    await expect(fetchCliente360("cli-1")).rejects.toThrow();
  });

  it("fetchCliente360 oportunidades=[] cuando data null", async () => {
    seedHappy();
    mock.setTableResult("crm_oportunidades", { data: null, error: null });
    const r = await fetchCliente360("cli-1");
    expect(r.oportunidades).toEqual([]);
  });

  it("fetchCliente360 filtra por cliente_id en las 3 tablas", async () => {
    seedHappy();
    await fetchCliente360("cli-XXX");
    const opsCall = mock.tableCalls.find((c) => c.table === "crm_oportunidades")!;
    expect(opsCall.opArgs[opsCall.ops.indexOf("eq")]).toEqual(["cliente_id", "cli-XXX"]);
  });

  it("fetchCliente360 limita oportunidades a 50", async () => {
    seedHappy();
    await fetchCliente360("cli-1");
    const opsCall = mock.tableCalls.find((c) => c.table === "crm_oportunidades")!;
    const limitIdx = opsCall.ops.indexOf("limit");
    expect(opsCall.opArgs[limitIdx]).toEqual([50]);
  });

  it("consulta totales sin el límite de 50 de la lista visible (soporta >50 oportunidades)", async () => {
    seedHappy();
    await fetchCliente360("cli-1");
    const opsCalls = mock.tableCalls.filter((c) => c.table === "crm_oportunidades");
    expect(opsCalls).toHaveLength(2);
    const limits = opsCalls.map((c) => c.opArgs[c.ops.indexOf("limit")][0]);
    expect(limits).toContain(50);
    expect(limits).toContain(5000);
  });
});
