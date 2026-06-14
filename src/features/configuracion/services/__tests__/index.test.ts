import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchConfiguracionByOrg,
  fetchConfiguracion,
  updateConfiguracionByCategoriaClave,
} from "../index";

describe("configuracion service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    vi.clearAllMocks();
  });

  it("fetchConfiguracionByOrg filtra por organization_id", async () => {
    mock.setTableResult("configuracion", { data: [], error: null });
    await fetchConfiguracionByOrg("org1");
    const call = mock.tableCalls.find((c) => c.table === "configuracion");
    expect(call?.ops).toEqual(
      expect.arrayContaining(["select", "eq", "order", "order"]),
    );
  });

  it("fetchConfiguracionByOrg propaga error de Supabase", async () => {
    mock.setTableResult("configuracion", {
      data: null,
      error: { message: "boom" },
    });
    await expect(fetchConfiguracionByOrg("org1")).rejects.toThrow();
  });

  it("fetchConfiguracion devuelve [] cuando data es null", async () => {
    mock.setTableResult("configuracion", { data: null, error: null });
    const res = await fetchConfiguracion();
    expect(res).toEqual([]);
  });

  it("updateConfiguracionByCategoriaClave hace update por item", async () => {
    mock.setTableResult("configuracion", { data: null, error: null });
    await updateConfiguracionByCategoriaClave([
      { categoria: "empresa", clave: "nombre", valor: "X" },
      { categoria: "empresa", clave: "rfc", valor: "Y" },
    ]);
    const calls = mock.tableCalls.filter((c) => c.table === "configuracion");
    expect(calls.length).toBe(2);
    expect(calls[0].ops).toContain("update");
  });
});
