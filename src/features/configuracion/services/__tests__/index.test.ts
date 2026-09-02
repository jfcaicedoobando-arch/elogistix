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

  it("fetchConfiguracion filtra por organization_id y devuelve [] cuando data es null", async () => {
    mock.setTableResult("configuracion", { data: null, error: null });
    const res = await fetchConfiguracion("org1");
    expect(res).toEqual([]);
    const call = mock.tableCalls.find((c) => c.table === "configuracion");
    expect(call?.opArgs).toContainEqual(["organization_id", "org1"]);
  });

  it("fetchConfiguracion falla cerrado sin organizationId (Ola 4 · N11)", async () => {
    await expect(fetchConfiguracion("")).rejects.toThrow(/organizationId/);
    expect(mock.tableCalls.find((c) => c.table === "configuracion")).toBeUndefined();
  });

  it("updateConfiguracionByCategoriaClave hace upsert por item (defecto 5)", async () => {
    mock.setTableResult("configuracion", { data: [{ id: "c1" }], error: null });
    await updateConfiguracionByCategoriaClave("org1", [
      { categoria: "empresa", clave: "nombre", valor: "X" },
      { categoria: "empresa", clave: "rfc", valor: "Y" },
    ]);
    const calls = mock.tableCalls.filter((c) => c.table === "configuracion");
    expect(calls.length).toBe(2);
    expect(calls[0].ops).toContain("upsert");
  });

  it("updateConfiguracionByCategoriaClave falla si no se escribió ninguna fila (defecto 5)", async () => {
    mock.setTableResult("configuracion", { data: [], error: null });
    await expect(
      updateConfiguracionByCategoriaClave("org1", [
        { categoria: "empresa", clave: "nombre", valor: "X" },
      ]),
    ).rejects.toThrow(/no se escribió ningún registro/);
  });

  it("updateConfiguracionByCategoriaClave exige organizationId (Ola 4 · N11)", async () => {
    await expect(
      updateConfiguracionByCategoriaClave("", [
        { categoria: "empresa", clave: "nombre", valor: "X" },
      ]),
    ).rejects.toThrow(/organizationId/);
    expect(mock.tableCalls.filter((c) => c.table === "configuracion")).toHaveLength(0);
  });

  it("updateConfiguracionByCategoriaClave escribe el organization_id en el upsert (Ola 4 · N11)", async () => {
    mock.setTableResult("configuracion", { data: [{ id: "c1" }], error: null });
    await updateConfiguracionByCategoriaClave("org-9", [
      { categoria: "empresa", clave: "nombre", valor: "Z" },
    ]);
    const call = mock.tableCalls.find((c) => c.table === "configuracion");
    expect(JSON.stringify(call?.opArgs)).toContain("org-9");
  });
});
