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

import { sincronizarEtapaPorEstadoCotizacion } from "../sincronizarEtapa";

const etapasMock = [
  { id: "e-abierta", tipo: "abierta", nombre: "Negociación", probabilidad_default: 60, activa: true, orden: 1 },
  { id: "e-ganada", tipo: "ganada", nombre: "Ganada", probabilidad_default: 100, activa: true, orden: 2 },
  { id: "e-perdida", tipo: "perdida", nombre: "Perdida", probabilidad_default: 0, activa: true, orden: 3 },
];

beforeEach(() => {
  mock.tableCalls.length = 0;
  fetchEtapasMock.mockReset();
  fetchEtapasMock.mockResolvedValue(etapasMock as never);
});

describe("sincronizarEtapaPorEstadoCotizacion", () => {
  it("Enviada → etapa abierta", async () => {
    mock.setTableResult("crm_oportunidades", { data: {}, error: null });
    await expect(sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-1", estadoCotizacion: "Enviada" })).resolves.toBeUndefined();
    expect(mock.tableCalls[0]?.ops).toContain("update");
  });

  it("Aceptada → etapa ganada con fecha_cierre_real", async () => {
    mock.setTableResult("crm_oportunidades", { data: {}, error: null });
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-1", estadoCotizacion: "Aceptada" });
    expect(mock.tableCalls[0]?.ops).toContain("update");
  });

  it("Rechazada → etapa perdida", async () => {
    mock.setTableResult("crm_oportunidades", { data: {}, error: null });
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-1", estadoCotizacion: "Rechazada" });
    expect(mock.tableCalls[0]?.ops).toContain("update");
  });

  it("estado desconocido → no-op (sin llamada a supabase update)", async () => {
    await sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-1", estadoCotizacion: "Borrador" });
    expect(mock.tableCalls).toHaveLength(0);
  });

  it("propaga error de supabase al sincronizar etapa", async () => {
    mock.setTableResult("crm_oportunidades", { data: null, error: { message: "rls" } });
    await expect(sincronizarEtapaPorEstadoCotizacion({ oportunidadId: "op-1", estadoCotizacion: "Enviada" })).rejects.toThrow();
  });
});
