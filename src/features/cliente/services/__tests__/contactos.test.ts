import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchContactosCliente,
  createContacto,
  updateContacto,
  deleteContacto,
  CONTACTO_COLUMNS,
} from "@/features/cliente/services/contactos";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
});

describe("services/cliente/contactos", () => {
  it("CONTACTO_COLUMNS incluye campos críticos", () => {
    expect(CONTACTO_COLUMNS).toMatch(/cliente_id/);
    expect(CONTACTO_COLUMNS).toMatch(/email/);
    expect(CONTACTO_COLUMNS).toMatch(/organization_id/);
  });

  it("fetchContactosCliente devuelve lista", async () => {
    mock.setTableResult("contactos_cliente", { data: [{ id: "c1" }], error: null });
    const r = await fetchContactosCliente("cli-1");
    expect(r).toHaveLength(1);
  });

  it("fetchContactosCliente devuelve [] cuando data null", async () => {
    mock.setTableResult("contactos_cliente", { data: null, error: null });
    const r = await fetchContactosCliente("cli-1");
    expect(r).toEqual([]);
  });

  it("fetchContactosCliente propaga error", async () => {
    mock.setTableResult("contactos_cliente", { data: null, error: { message: "x" } });
    await expect(fetchContactosCliente("cli-1")).rejects.toThrow();
  });

  it("createContacto inserta y devuelve la fila", async () => {
    mock.setTableResult("contactos_cliente", { data: { id: "c1" }, error: null });
    const r = await createContacto({ cliente_id: "cli-1", nombre: "X" } as never);
    expect(r).toEqual({ id: "c1" });
  });

  it("createContacto propaga error", async () => {
    mock.setTableResult("contactos_cliente", { data: null, error: { message: "x" } });
    await expect(createContacto({} as never)).rejects.toThrow();
  });

  it("updateContacto actualiza", async () => {
    mock.setTableResult("contactos_cliente", { data: null, error: null });
    await expect(updateContacto("c1", { nombre: "Y" })).resolves.toBeUndefined();
    expect(mock.tableCalls[0].ops).toContain("update");
  });

  it("updateContacto propaga error", async () => {
    mock.setTableResult("contactos_cliente", { data: null, error: { message: "x" } });
    await expect(updateContacto("c1", { nombre: "Y" })).rejects.toThrow();
  });

  it("deleteContacto llama RPC soft_delete_record", async () => {
    mock.setRpcResult("soft_delete_record", { data: null, error: null });
    await deleteContacto("c1");
    expect(mock.rpcCalls[0].fn).toBe("soft_delete_record");
    expect((mock.rpcCalls[0].args as Record<string, unknown>)._table).toBe("contactos_cliente");
    expect((mock.rpcCalls[0].args as Record<string, unknown>)._id).toBe("c1");
  });

  it("deleteContacto propaga error", async () => {
    mock.setRpcResult("soft_delete_record", { data: null, error: { message: "x" } });
    await expect(deleteContacto("c1")).rejects.toThrow();
  });
});
