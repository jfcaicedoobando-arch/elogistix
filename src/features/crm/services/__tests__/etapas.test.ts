import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));

import { registrarActividad } from "@/services/bitacora/registrar";

import {
  fetchEtapasPipelineActivas,
  fetchEtapasPipelineTodas,
  actualizarEtapa,
  fetchMotivosPerdida,
  actualizarMotivoPerdida,
  crearMotivoPerdida,
} from "@/features/crm/services/etapas";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("services/crm/etapas", () => {
  it("fetchEtapasPipelineActivas filtra activa=true", async () => {
    mock.setTableResult("crm_etapas_pipeline", { data: [{ id: "e1" }], error: null });
    const r = await fetchEtapasPipelineActivas();
    expect(r).toHaveLength(1);
    const call = mock.tableCalls[0];
    const eqIdx = call.ops.indexOf("eq");
    expect(call.opArgs[eqIdx]).toEqual(["activa", true]);
  });

  it("fetchEtapasPipelineActivas devuelve [] cuando data null", async () => {
    mock.setTableResult("crm_etapas_pipeline", { data: null, error: null });
    expect(await fetchEtapasPipelineActivas()).toEqual([]);
  });

  it("fetchEtapasPipelineActivas propaga error", async () => {
    mock.setTableResult("crm_etapas_pipeline", { data: null, error: { message: "x" } });
    await expect(fetchEtapasPipelineActivas()).rejects.toThrow();
  });

  it("fetchEtapasPipelineTodas no aplica filtro activa", async () => {
    mock.setTableResult("crm_etapas_pipeline", { data: [{ id: "e1" }], error: null });
    const r = await fetchEtapasPipelineTodas();
    expect(r).toHaveLength(1);
    expect(mock.tableCalls[0].ops).not.toContain("eq");
  });

  it("fetchEtapasPipelineTodas propaga error", async () => {
    mock.setTableResult("crm_etapas_pipeline", { data: null, error: { message: "x" } });
    await expect(fetchEtapasPipelineTodas()).rejects.toThrow();
  });

  it("actualizarEtapa hace update con patch", async () => {
    mock.setTableResult("crm_etapas_pipeline", { data: null, error: null });
    await actualizarEtapa({ id: "e1", patch: { nombre: "Nueva" } });
    const upd = mock.tableCalls[0].opArgs[mock.tableCalls[0].ops.indexOf("update")]?.[0];
    expect(upd).toEqual({ nombre: "Nueva" });
  });

  it("actualizarEtapa propaga error", async () => {
    mock.setTableResult("crm_etapas_pipeline", { data: null, error: { message: "x" } });
    await expect(actualizarEtapa({ id: "e1", patch: {} })).rejects.toThrow();
  });

  it("fetchMotivosPerdida soloActivos=true por default", async () => {
    mock.setTableResult("crm_motivos_perdida", { data: [{ id: "m1" }], error: null });
    await fetchMotivosPerdida();
    expect(mock.tableCalls[0].ops).toContain("eq");
  });

  it("fetchMotivosPerdida soloActivos=false omite filtro", async () => {
    mock.setTableResult("crm_motivos_perdida", { data: [], error: null });
    await fetchMotivosPerdida(false);
    expect(mock.tableCalls[0].ops).not.toContain("eq");
  });

  it("fetchMotivosPerdida propaga error", async () => {
    mock.setTableResult("crm_motivos_perdida", { data: null, error: { message: "x" } });
    await expect(fetchMotivosPerdida()).rejects.toThrow();
  });

  it("actualizarMotivoPerdida update", async () => {
    mock.setTableResult("crm_motivos_perdida", { data: null, error: null });
    await actualizarMotivoPerdida({ id: "m1", patch: { activa: false } });
    expect(mock.tableCalls[0].ops).toContain("update");
  });

  it("actualizarMotivoPerdida propaga error", async () => {
    mock.setTableResult("crm_motivos_perdida", { data: null, error: { message: "x" } });
    await expect(actualizarMotivoPerdida({ id: "m1", patch: {} })).rejects.toThrow();
  });

  it("crearMotivoPerdida inserta con activa=true", async () => {
    mock.setTableResult("crm_motivos_perdida", { data: null, error: null });
    await crearMotivoPerdida("Precio");
    const ins = mock.tableCalls[0].opArgs[mock.tableCalls[0].ops.indexOf("insert")]?.[0];
    expect(ins).toEqual({ nombre: "Precio", activa: true });
  });

  it("crearMotivoPerdida propaga error", async () => {
    mock.setTableResult("crm_motivos_perdida", { data: null, error: { message: "x" } });
    await expect(crearMotivoPerdida("X")).rejects.toThrow();
  });
});
