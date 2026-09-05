import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: vi.fn() }));

import { registrarActividad } from "@/services/bitacora/registrar";

import {
  fetchCriteriosPorEtapa,
  crearCriterioEtapa,
  actualizarCriterioEtapa,
  eliminarCriterioEtapa,
} from "@/features/crm/services/criteriosEtapa";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
  mock.resetResults();
});

describe("services/crm/criteriosEtapa", () => {
  it("fetchCriteriosPorEtapa filtra por etapa_id", async () => {
    mock.setTableResult("crm_etapa_criterios", { data: [{ id: "c1" }], error: null });
    await fetchCriteriosPorEtapa("e1");
    const call = mock.tableCalls[0];
    expect(call.ops).toContain("eq");
  });

  it("actualizarCriterioEtapa actualiza cuando hay fila afectada", async () => {
    vi.mocked(registrarActividad).mockClear();
    mock.setTableResult("crm_etapa_criterios", { data: { id: "c1" }, error: null });
    await actualizarCriterioEtapa({ id: "c1", patch: { nombre: "Nuevo" } });
    const call = mock.tableCalls[0];
    const idx = call.ops.indexOf("update");
    expect(call.opArgs[idx][0]).toEqual({ nombre: "Nuevo" });
    expect(registrarActividad).toHaveBeenCalledTimes(1);
  });

  it("actualizarCriterioEtapa exige fila afectada y no registra bitácora si RLS/id inexistente", async () => {
    vi.mocked(registrarActividad).mockClear();
    mock.setTableResult("crm_etapa_criterios", { data: null, error: null });
    await expect(actualizarCriterioEtapa({ id: "c1", patch: { nombre: "Nuevo" } })).rejects.toThrow(
      /no tienes permiso|ya no existe/i,
    );
    expect(registrarActividad).not.toHaveBeenCalled();
  });

  it("actualizarCriterioEtapa propaga error", async () => {
    mock.setTableResult("crm_etapa_criterios", { data: null, error: { message: "x" } });
    await expect(actualizarCriterioEtapa({ id: "c1", patch: {} })).rejects.toThrow();
  });

  it("eliminarCriterioEtapa hace soft-delete con deleted_at y deleted_by", async () => {
    vi.mocked(registrarActividad).mockClear();
    mock.setTableResult("crm_etapa_criterios", { data: { id: "c1" }, error: null });
    await eliminarCriterioEtapa("c1", "u1");
    const payload = mock.getMutationPayload("crm_etapa_criterios", "update") as Record<string, unknown>;
    expect(payload.deleted_at).toEqual(expect.any(String));
    expect(payload.deleted_by).toBe("u1");
    expect(payload.activo).toBe(false);
    expect(registrarActividad).toHaveBeenCalledTimes(1);
  });

  it("eliminarCriterioEtapa exige fila afectada y no registra bitácora si no existe/RLS", async () => {
    vi.mocked(registrarActividad).mockClear();
    mock.setTableResult("crm_etapa_criterios", { data: null, error: null });
    await expect(eliminarCriterioEtapa("c1", "u1")).rejects.toThrow(/no tienes permiso|ya no existe/i);
    expect(registrarActividad).not.toHaveBeenCalled();
  });

  it("eliminarCriterioEtapa propaga error", async () => {
    mock.setTableResult("crm_etapa_criterios", { data: null, error: { message: "x" } });
    await expect(eliminarCriterioEtapa("c1", "u1")).rejects.toThrow();
  });
});
