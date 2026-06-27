/**
 * Tests for src/services/embarque/documentos.ts
 * Focused on resolverExpediente helper.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

// Mock storage to avoid real uploads
vi.mock("@/services/storage/index", () => ({
  uploadFile: vi.fn().mockResolvedValue(undefined),
  deleteFile: vi.fn().mockResolvedValue(undefined),
}));

import { resolverExpediente } from "@/features/embarques/services/documentos";

beforeEach(() => {
  // Evita acoplamiento de orden entre tests bajo singleFork: limpia los
  // registros de llamadas acumulados en el mock de Supabase.
  mock.rpcCalls.length = 0;
  mock.tableCalls.length = 0;
});

describe("resolverExpediente", () => {
  it("calls resolver_expediente_por_bl RPC when blMaster is provided", async () => {
    mock.setRpcResult("resolver_expediente_por_bl", { data: "EXP-001", error: null });
    const result = await resolverExpediente("BL123", "Importación");
    expect(result).toBe("EXP-001");
    const call = mock.rpcCalls.find((c) => c.fn === "resolver_expediente_por_bl");
    expect(call).toBeDefined();
    expect((call?.args as { _bl_master: string })._bl_master).toBe("BL123");
    expect((call?.args as { _tipo_op: string })._tipo_op).toBe("Importación");
  });

  it("calls generar_expediente RPC when blMaster is undefined", async () => {
    mock.setRpcResult("generar_expediente", { data: "EXP-002", error: null });
    const result = await resolverExpediente(undefined, "Exportación");
    expect(result).toBe("EXP-002");
    const call = mock.rpcCalls.find((c) => c.fn === "generar_expediente");
    expect(call).toBeDefined();
  });

  it("calls generar_expediente RPC when blMaster is null", async () => {
    mock.setRpcResult("generar_expediente", { data: "EXP-003", error: null });
    const result = await resolverExpediente(null, "Exportación");
    expect(result).toBe("EXP-003");
  });

  it("calls generar_expediente when blMaster is whitespace-only", async () => {
    mock.setRpcResult("generar_expediente", { data: "EXP-004", error: null });
    const result = await resolverExpediente("   ", "Importación");
    expect(result).toBe("EXP-004");
  });

  it("throws when resolver_expediente_por_bl returns error", async () => {
    mock.setRpcResult("resolver_expediente_por_bl", { data: null, error: new Error("rls denied") });
    await expect(resolverExpediente("BL-X", "Importación")).rejects.toThrow("rls denied");
  });

  it("throws when resolver_expediente_por_bl returns null data", async () => {
    mock.setRpcResult("resolver_expediente_por_bl", { data: null, error: null });
    await expect(resolverExpediente("BL-Y", "Importación")).rejects.toThrow(
      /No se pudo resolver/,
    );
  });

  it("throws when generar_expediente returns error", async () => {
    mock.setRpcResult("generar_expediente", { data: null, error: new Error("seq fail") });
    await expect(resolverExpediente(undefined, "Exportación")).rejects.toThrow("seq fail");
  });
});
