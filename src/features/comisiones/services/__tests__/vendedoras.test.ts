import { describe, it, expect, vi, beforeEach } from "vitest";

const { mock, mockNombresUsuarios } = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return {
    mock: createSupabaseMock(),
    mockNombresUsuarios: vi.fn(),
  };
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/features/admin/services/usuario/availableUsers", () => ({
  fetchNombresUsuarios: mockNombresUsuarios,
}));

import { 
  fetchVendedorasConfig, 
  upsertVendedoraConfig, 
  updateVendedoraConfig,
  fetchUsuariosVendedores,
  fetchEmbarquesSinVendedora,
  asignarVendedoraEmbarque
} from "../vendedoras";
import { UNRESOLVED_EMAIL } from "@/features/admin/services/usuario";

describe("vendedoras service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.resetResults();
    mockNombresUsuarios.mockReset();
  });

  it("fetchVendedorasConfig: mezcla con nombres y maneja errores de usuarios", async () => {
    // 1. Success
    mock.setTableResult("vendedora_config", { data: [{ user_id: "u1", porcentaje_default: 5 }], error: null });
    mockNombresUsuarios.mockResolvedValueOnce([{ id: "u1", full_name: "Ana Uno" }]);
    const res = await fetchVendedorasConfig();
    expect(res[0].nombre).toBe("Ana Uno");

    // 2. buildNombreMap empty ids
    mock.setTableResult("vendedora_config", { data: [], error: null });
    expect(await fetchVendedorasConfig()).toEqual([]);

    // 3. fetchNombresUsuarios falla (buildNombreMap catch)
    mock.setTableResult("vendedora_config", { data: [{ user_id: "u1" }], error: null });
    mockNombresUsuarios.mockRejectedValueOnce(new Error("fail"));
    const resFail = await fetchVendedorasConfig();
    expect(resFail[0].nombre).toBe(UNRESOLVED_EMAIL);
  });

  it("upsertVendedoraConfig: hace upsert", async () => {
    mock.setTableResult("vendedora_config", { data: [], error: null });
    await upsertVendedoraConfig({ organization_id: "o1", user_id: "u1", porcentaje_default: 5 });
    expect(mock.tableCalls[0].ops).toContain("upsert");
  });

  it("updateVendedoraConfig: hace update", async () => {
    mock.setTableResult("vendedora_config", { data: [], error: null });
    await updateVendedoraConfig("id-1", { activa: false });
    expect(mock.tableCalls[0].ops).toContain("update");
    expect(mock.tableCalls[0].ops).toContain("eq");
  });

  it("fetchUsuariosVendedores: filtra por rol y ordena por nombre", async () => {
    mock.setTableResult("organization_members", { 
      data: [
        { user_id: "u1", role: "vendedor" }, 
        { user_id: "u2", role: "admin" },
        { user_id: "u3", role: "usuario" }
      ], 
      error: null 
    });
    mockNombresUsuarios.mockResolvedValue([
      { id: "u1", full_name: "Beto" },
      { id: "u2", full_name: "Ana" }
    ]);
    const res = await fetchUsuariosVendedores();
    expect(res.length).toBe(2);
    expect(res[0].nombre).toBe("Ana"); // Ordenado por nombre
    expect(res[1].nombre).toBe("Beto");
  });

  it("fetchEmbarquesSinVendedora: consulta embarques filtrando nulos", async () => {
    mock.setTableResult("embarques", { 
      data: [{ id: "e1", expediente: "EXP-1", cliente_nombre: "C1", created_at: "2023-01-01" }], 
      error: null 
    });
    const res = await fetchEmbarquesSinVendedora();
    expect(res[0].id).toBe("e1");
    expect(mock.tableCalls[0].ops).toContain("is");
  });

  it("asignarVendedoraEmbarque: actualiza vendedora_id", async () => {
    mock.setTableResult("embarques", { data: [], error: null });
    await asignarVendedoraEmbarque("e1", "v1");
    expect(mock.tableCalls[0].ops).toContain("update");
    expect(mock.getMutationPayload("embarques", "update")).toEqual({ vendedora_id: "v1" });
  });

  it.each([
    ["fetchVendedorasConfig", fetchVendedorasConfig, []],
    ["upsertVendedoraConfig", upsertVendedoraConfig, [{ organization_id: "o1" }]],
    ["updateVendedoraConfig", updateVendedoraConfig, ["id1", { activa: true }]],
    ["fetchUsuariosVendedores", fetchUsuariosVendedores, []],
    ["fetchEmbarquesSinVendedora", fetchEmbarquesSinVendedora, []],
    ["asignarVendedoraEmbarque", asignarVendedoraEmbarque, ["e1", "v1"]],
  ])("%s: propaga error de supabase", async (_, fn, args) => {
    mock.resetResults();
    mock.setTableResult("vendedora_config", { data: null, error: new Error("db error") });
    mock.setTableResult("organization_members", { data: null, error: new Error("db error") });
    mock.setTableResult("embarques", { data: null, error: new Error("db error") });
    await expect((fn as any)(...args)).rejects.toThrow("db error");
  });
});
