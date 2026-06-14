import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

const { fetchEtapasMock } = vi.hoisted(() => ({ fetchEtapasMock: vi.fn() }));
vi.mock("@/features/crm/services/etapas", () => ({
  fetchEtapasPipelineActivas: fetchEtapasMock,
}));

import {
  buildOpNombre,
  resolveEtapaCotizandoId,
  setCotizacionOportunidad,
} from "../helpers";

beforeEach(() => {
  mock.tableCalls.length = 0;
  fetchEtapasMock.mockReset();
});

describe("vincularCotizacion/helpers", () => {
  it("vincular.buildOpNombre: usa folio cuando viene", () => {
    expect(buildOpNombre("ACME", "COT-001")).toBe("ACME — COT-001");
  });

  it("vincular.buildOpNombre: fallback sin folio", () => {
    expect(buildOpNombre("ACME")).toBe("Cotización · ACME");
  });

  it("vincular.buildOpNombre: empresa vacía sigue patrón", () => {
    expect(buildOpNombre("", "F1")).toBe(" — F1");
  });

  it("vincular.resolveEtapa: devuelve null si no hay etapas abiertas", async () => {
    fetchEtapasMock.mockResolvedValue([{ id: "x", nombre: "Ganada", tipo: "ganada", probabilidad_default: 100 }]);
    expect(await resolveEtapaCotizandoId()).toBeNull();
  });

  it("vincular.resolveEtapa: prioriza etapa que contiene 'cotiz'", async () => {
    fetchEtapasMock.mockResolvedValue([
      { id: "a", nombre: "Prospección", tipo: "abierta", probabilidad_default: 10 },
      { id: "b", nombre: "Cotizando", tipo: "abierta", probabilidad_default: 30 },
    ]);
    const r = await resolveEtapaCotizandoId();
    expect(r).toEqual({ id: "b", probabilidad: 30 });
  });

  it("vincular.resolveEtapa: fallback a primera abierta si no hay 'cotiz'", async () => {
    fetchEtapasMock.mockResolvedValue([
      { id: "a", nombre: "Prospección", tipo: "abierta", probabilidad_default: 15 },
    ]);
    const r = await resolveEtapaCotizandoId();
    expect(r?.id).toBe("a");
    expect(r?.probabilidad).toBe(15);
  });

  it("vincular.resolveEtapa: default probabilidad 30 cuando es null", async () => {
    fetchEtapasMock.mockResolvedValue([
      { id: "a", nombre: "Cotizando", tipo: "abierta", probabilidad_default: null },
    ]);
    const r = await resolveEtapaCotizandoId();
    expect(r?.probabilidad).toBe(30);
  });

  it("vincular.resolveEtapa: ignora etapas cerradas (ganada/perdida)", async () => {
    fetchEtapasMock.mockResolvedValue([
      { id: "g", nombre: "Ganada", tipo: "ganada", probabilidad_default: 100 },
      { id: "p", nombre: "Perdida", tipo: "perdida", probabilidad_default: 0 },
    ]);
    expect(await resolveEtapaCotizandoId()).toBeNull();
  });

  it("vincular.setCotizacionOportunidad: hace update con eq", async () => {
    mock.setTableResult("cotizaciones", { data: null, error: null });
    await setCotizacionOportunidad("cot-1", "op-1");
    const call = mock.tableCalls.find((c) => c.table === "cotizaciones");
    expect(call?.ops).toContain("update");
    expect(call?.ops).toContain("eq");
    const payload = mock.getMutationPayload("cotizaciones", "update") as Record<string, unknown>;
    expect(payload.oportunidad_id).toBe("op-1");
  });

  it("vincular.setCotizacionOportunidad: propaga error", async () => {
    mock.setTableResult("cotizaciones", { data: null, error: { message: "boom" } });
    await expect(setCotizacionOportunidad("c", "o")).rejects.toThrow();
  });
});
