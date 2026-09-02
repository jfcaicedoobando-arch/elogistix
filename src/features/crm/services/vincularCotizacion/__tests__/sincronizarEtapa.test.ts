/**
 * v13.823.32: la etapa se deriva del CONJUNTO de cotizaciones vivas de la
 * oportunidad, no del último evento.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
const { fetchEtapasMock } = vi.hoisted(() => ({ fetchEtapasMock: vi.fn() }));
vi.mock("@/features/crm/services/etapas", () => ({
  fetchEtapasPipelineActivas: fetchEtapasMock,
}));

import { sincronizarEtapaPorEstadoCotizacion, derivarTipoEtapa } from "../sincronizarEtapa";

const etapasMock = [
  { id: "e-abierta", tipo: "abierta", nombre: "Negociación", probabilidad_default: 60, activa: true, orden: 1 },
  { id: "e-ganada", tipo: "ganada", nombre: "Ganada", probabilidad_default: 100, activa: true, orden: 2 },
  { id: "e-perdida", tipo: "perdida", nombre: "Perdida", probabilidad_default: 0, activa: true, orden: 3 },
];

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.resetResults();
  fetchEtapasMock.mockReset();
  fetchEtapasMock.mockResolvedValue(etapasMock as never);
});

describe("derivarTipoEtapa (precedencia)", () => {
  it("Aceptada gana sobre Rechazada", () => {
    expect(derivarTipoEtapa(["Aceptada", "Rechazada"])).toBe("ganada");
  });
  it("Enviada gana sobre Rechazada", () => {
    expect(derivarTipoEtapa(["Enviada", "Rechazada"])).toBe("abierta");
  });
  it("perdida sólo si todas están Rechazadas", () => {
    expect(derivarTipoEtapa(["Rechazada", "Rechazada"])).toBe("perdida");
    expect(derivarTipoEtapa(["Rechazada", "Borrador"])).toBeNull();
  });
  it("sin cotizaciones → null", () => {
    expect(derivarTipoEtapa([])).toBeNull();
  });
});

describe("sincronizarEtapaPorEstadoCotizacion", () => {
  it("dos cotizaciones (una aceptada, una rechazada) → NO marca perdida", async () => {
    mock.setTableResult("cotizaciones", {
      data: [{ id: "c1", estado: "Aceptada" }, { id: "c2", estado: "Rechazada" }],
      error: null,
    });
    mock.setTableResult("crm_oportunidades", { data: { id: "op-1" }, error: null });
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-1", estadoCotizacion: "Rechazada" });
    const update = mock.tableCalls.find((c) => c.table === "crm_oportunidades");
    expect(update?.ops).toContain("update");
    expect(JSON.stringify(update?.payload ?? {})).toContain("e-ganada");
  });

  it("todas rechazadas → etapa perdida", async () => {
    mock.setTableResult("cotizaciones", { data: [{ id: "c1", estado: "Rechazada" }], error: null });
    mock.setTableResult("crm_oportunidades", { data: { id: "op-1" }, error: null });
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-1", estadoCotizacion: "Rechazada" });
    const update = mock.tableCalls.find((c) => c.table === "crm_oportunidades");
    expect(JSON.stringify(update?.payload ?? {})).toContain("e-perdida");
  });

  it("sin tipo derivable → no toca la oportunidad", async () => {
    mock.setTableResult("cotizaciones", { data: [{ id: "c1", estado: "Borrador" }], error: null });
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-1", estadoCotizacion: "Borrador" });
    expect(mock.tableCalls.some((c) => c.table === "crm_oportunidades")).toBe(false);
  });

  it("propaga error de supabase al sincronizar etapa", async () => {
    mock.setTableResult("cotizaciones", { data: [{ id: "c1", estado: "Enviada" }], error: null });
    mock.setTableResult("crm_oportunidades", { data: null, error: { message: "rls" } });
    await expect(
      sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-1", estadoCotizacion: "Enviada" }),
    ).rejects.toThrow();
  });
});
