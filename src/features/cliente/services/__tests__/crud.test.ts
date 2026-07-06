import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { createCliente, updateCliente } from "../crud";

const validInsert = {
  nombre: "Acme SA de CV",
  rfc: "ACM010101AAA",
  email: "admin@acme.com",
  organization_id: "00000000-0000-0000-0000-000000000001",
} as Parameters<typeof createCliente>[0];

beforeEach(() => { mock.tableCalls.length = 0; mock.rpcCalls.length = 0; mock.resetResults(); });

describe("createCliente", () => {
  it("happy path: inserta y devuelve data", async () => {
    mock.setTableResult("clientes", { data: { id: "c-1", ...validInsert }, error: null });
    const r = await createCliente(validInsert);
    expect(r.id).toBe("c-1");
    expect(mock.tableCalls[0]?.ops).toContain("insert");
  });

  it("propaga error de supabase al crear cliente", async () => {
    mock.setTableResult("clientes", { data: null, error: { message: "RLS denied" } });
    await expect(createCliente(validInsert)).rejects.toThrow();
  });

  it("zod: nombre vacío lanza antes del insert", async () => {
    await expect(createCliente({ ...validInsert, nombre: "" })).rejects.toThrow();
    expect(mock.tableCalls).toHaveLength(0);
  });
});

describe("updateCliente", () => {
  it("happy path: actualiza y devuelve data", async () => {
    mock.setTableResult("clientes", { data: { id: "c-1", nombre: "Nuevo" }, error: null });
    const r = await updateCliente("c-1", { nombre: "Nuevo" });
    expect(r.nombre).toBe("Nuevo");
    expect(mock.tableCalls[0]?.ops).toContain("update");
  });

  it("propaga error de supabase al actualizar cliente", async () => {
    mock.setTableResult("clientes", { data: null, error: { message: "conflict" } });
    await expect(updateCliente("c-1", { nombre: "X" })).rejects.toThrow();
  });

  it("zod: email malformado lanza antes del update", async () => {
    await expect(updateCliente("c-1", { email: "not-an-email" })).rejects.toThrow();
    expect(mock.tableCalls).toHaveLength(0);
  });
});
