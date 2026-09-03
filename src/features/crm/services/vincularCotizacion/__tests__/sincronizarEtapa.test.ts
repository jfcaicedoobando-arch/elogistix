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
    expect(JSON.stringify(update?.opArgs ?? [])).toContain("e-ganada");
  });

  it("todas rechazadas → etapa perdida", async () => {
    mock.setTableResult("cotizaciones", { data: [{ id: "c1", estado: "Rechazada" }], error: null });
    mock.setTableResult("crm_oportunidades", { data: { id: "op-1" }, error: null });
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-1", estadoCotizacion: "Rechazada" });
    const update = mock.tableCalls.find((c) => c.table === "crm_oportunidades");
    expect(JSON.stringify(update?.opArgs ?? [])).toContain("e-perdida");
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

// P1-B (13.823.70): volver a etapa abierta limpia los datos de cierre.
describe("limpieza de cierre al reabrir (P1-B)", () => {
  const patchDe = () => {
    const call = mock.tableCalls.find((c) => c.table === "crm_oportunidades");
    return (call?.opArgs?.[0] ?? {}) as Record<string, unknown>;
  };

  it("perdida → abierta limpia fecha_cierre_real y motivo_perdida_id", async () => {
    mock.setTableResult("cotizaciones", { data: [{ id: "c1", estado: "Enviada" }], error: null });
    mock.setTableResult("crm_oportunidades", { data: { id: "op-1" }, error: null });
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-1", estadoCotizacion: "Enviada" });
    const patch = patchDe();
    expect(patch.etapa_id).toBe("e-abierta");
    expect(patch.fecha_cierre_real).toBeNull();
    expect(patch.motivo_perdida_id).toBeNull();
    expect(patch.valor_real).toBeNull();
  });

  it("ganada → abierta también limpia el cierre", async () => {
    mock.setTableResult("cotizaciones", { data: [{ id: "c1", estado: "Solicitada" }], error: null });
    mock.setTableResult("crm_oportunidades", { data: { id: "op-2" }, error: null });
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-2", estadoCotizacion: "Solicitada" });
    const patch = patchDe();
    expect(patch.etapa_id).toBe("e-abierta");
    expect(patch.fecha_cierre_real).toBeNull();
    expect(patch.motivo_perdida_id).toBeNull();
  });

  it("ganada limpia motivo_perdida_id y fija fecha de cierre", async () => {
    mock.setTableResult("cotizaciones", { data: [{ id: "c1", estado: "Aceptada" }], error: null });
    mock.setTableResult("crm_oportunidades", { data: { id: "op-3" }, error: null });
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-3", estadoCotizacion: "Aceptada" });
    const patch = patchDe();
    expect(patch.etapa_id).toBe("e-ganada");
    expect(patch.motivo_perdida_id).toBeNull();
    expect(typeof patch.fecha_cierre_real).toBe("string");
  });

  it("perdida conserva su motivo_perdida_id", async () => {
    mock.setTableResult("cotizaciones", { data: [{ id: "c1", estado: "Rechazada" }], error: null });
    mock.setTableResult("crm_oportunidades", { data: { id: "op-4" }, error: null });
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-4", estadoCotizacion: "Rechazada" });
    const patch = patchDe();
    expect(patch.etapa_id).toBe("e-perdida");
    expect("motivo_perdida_id" in patch).toBe(false);
    expect(typeof patch.fecha_cierre_real).toBe("string");
  });

  it("varias cotizaciones: una aceptada mantiene ganada y no reabre", async () => {
    mock.setTableResult("cotizaciones", {
      data: [{ id: "c1", estado: "Aceptada" }, { id: "c2", estado: "Enviada" }],
      error: null,
    });
    mock.setTableResult("crm_oportunidades", { data: { id: "op-5" }, error: null });
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-5", estadoCotizacion: "Enviada" });
    const patch = patchDe();
    expect(patch.etapa_id).toBe("e-ganada");
    expect(typeof patch.fecha_cierre_real).toBe("string");
  });
});
