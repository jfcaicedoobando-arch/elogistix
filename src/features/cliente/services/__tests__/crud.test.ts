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
  organization_id: "11111111-1111-4111-8111-111111111111",
} as Parameters<typeof createCliente>[0];

beforeEach(() => { mock.tableCalls.length = 0; mock.rpcCalls.length = 0; mock.resetResults(); });

describe("createCliente", () => {
  // M4 (auditoría 3-3): el alta ya no hace INSERT directo; usa la RPC canónica.
  it("happy path: llama a la RPC crear_clientes y devuelve el cliente", async () => {
    mock.setRpcResult("crear_clientes", { data: [{ id: "c-1", ...validInsert }], error: null });
    const r = await createCliente(validInsert);
    expect(r.id).toBe("c-1");
    expect(mock.rpcCalls[0]?.fn).toBe("crear_clientes");
    // El alta no hace INSERT a `clientes` (sólo la RPC); la bitácora sí escribe.
    expect(mock.tableCalls.filter((c) => c.table === "clientes")).toHaveLength(0);
  });

  it("propaga error de la RPC al crear cliente", async () => {
    mock.setRpcResult("crear_clientes", { data: null, error: { message: "LC_CLIENTE_FISCAL_INCOMPLETO" } });
    await expect(createCliente(validInsert)).rejects.toThrow();
  });

  it("zod: nombre vacío lanza antes de llamar a la RPC", async () => {
    await expect(createCliente({ ...validInsert, nombre: "" })).rejects.toThrow();
    expect(mock.rpcCalls).toHaveLength(0);
  });
});

describe("updateCliente", () => {
  it("happy path: actualiza y devuelve data", async () => {
    // N-06: `updateCliente` ahora usa `.select()` (lista) para detectar 0 filas.
    mock.setTableResult("clientes", { data: [{ id: "c-1", nombre: "Nuevo" }], error: null });
    const r = await updateCliente("c-1", { nombre: "Nuevo" });
    expect(r.nombre).toBe("Nuevo");
    expect(mock.tableCalls[0]?.ops).toContain("update");
  });

  it("propaga error de supabase al actualizar cliente", async () => {
    mock.setTableResult("clientes", { data: null, error: { message: "conflict" } });
    await expect(updateCliente("c-1", { nombre: "X" })).rejects.toThrow();
  });

  it("N-06: 0 filas con expectedUpdatedAt lanza conflicto de concurrencia", async () => {
    mock.setTableResult("clientes", { data: [], error: null });
    await expect(
      updateCliente("c-1", { nombre: "X" }, "2026-01-01T00:00:00Z"),
    ).rejects.toThrow(/LC_CONFLICTO_CONCURRENCIA/);
  });

  it("zod: email malformado lanza antes del update", async () => {
    await expect(updateCliente("c-1", { email: "not-an-email" })).rejects.toThrow();
    // El alta no hace INSERT a `clientes` (sólo la RPC); la bitácora sí escribe.
    expect(mock.tableCalls.filter((c) => c.table === "clientes")).toHaveLength(0);
  });
});
