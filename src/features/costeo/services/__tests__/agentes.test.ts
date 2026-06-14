import { describe, it, expect, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchCosteoAgentes,
  insertCosteoAgente,
  updateCosteoAgente,
  deleteCosteoAgente,
  fetchProveedoresPorTipo,
} from "../agentes";

const ORG = "00000000-0000-0000-0000-000000000001";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("costeo/services/agentes", () => {
  it("fetchCosteoAgentes filtra por organization_id y ordena por nombre", async () => {
    mock.setTableResult("costeo_agentes", { data: [{ id: "a1", nombre: "Acme" }], error: null });
    const res = await fetchCosteoAgentes(ORG);
    const call = mock.tableCalls.find((c) => c.table === "costeo_agentes");
    expect(call?.ops).toContain("select");
    expect(call?.ops).toContain("eq");
    expect(call?.ops).toContain("order");
    expect(res[0].nombre).toBe("Acme");
  });

  it("insertCosteoAgente aplica defaults (pais=CN, activo=true)", async () => {
    mock.setTableResult("costeo_agentes", { data: { id: "a2", nombre: "Nuevo" }, error: null });
    await insertCosteoAgente(ORG, { nombre: "Nuevo", proveedor_id: "p1", dias_credito: 15 });
    const payload = mock.getMutationPayload("costeo_agentes", "insert") as Record<string, unknown>;
    expect(payload.pais).toBe("CN");
    expect(payload.activo).toBe(true);
    expect(payload.organization_id).toBe(ORG);
  });

  it("updateCosteoAgente envía el patch a la tabla", async () => {
    mock.setTableResult("costeo_agentes", { data: { id: "a3", nombre: "X" }, error: null });
    await updateCosteoAgente("a3", { nombre: "X" });
    const payload = mock.getMutationPayload("costeo_agentes", "update") as Record<string, unknown>;
    expect(payload.nombre).toBe("X");
  });

  it("deleteCosteoAgente llama delete().eq('id', ...)", async () => {
    mock.setTableResult("costeo_agentes", { data: null, error: null });
    await deleteCosteoAgente("a3");
    const call = mock.tableCalls.find((c) => c.table === "costeo_agentes");
    expect(call?.ops).toContain("delete");
    expect(call?.ops).toContain("eq");
  });

  it("fetchProveedoresPorTipo filtra por tipo y limita a 500", async () => {
    mock.setTableResult("proveedores", { data: [{ id: "p1", nombre: "Cosco", pais: "CN" }], error: null });
    const res = await fetchProveedoresPorTipo("Naviera");
    const call = mock.tableCalls.find((c) => c.table === "proveedores");
    expect(call?.ops).toContain("eq");
    expect(call?.ops).toContain("limit");
    expect(res[0].nombre).toBe("Cosco");
  });

  it("fetchCosteoAgentes propaga errores", async () => {
    mock.setTableResult("costeo_agentes", { data: null, error: { message: "boom" } });
    await expect(fetchCosteoAgentes(ORG)).rejects.toThrow();
  });
});
