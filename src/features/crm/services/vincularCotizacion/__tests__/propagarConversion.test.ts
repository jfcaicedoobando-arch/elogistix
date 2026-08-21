import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { propagarConversionProspectoCRM } from "../propagarConversion";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
  mock.resetResults();
});

describe("propagarConversionProspectoCRM", () => {
  it("no-op cuando oportunidadId es null", async () => {
    await expect(
      propagarConversionProspectoCRM({ oportunidadId: null, clienteId: "c-1", clienteNombre: "Acme" }),
    ).resolves.toBeUndefined();
    expect(mock.rpcCalls).toHaveLength(0);
    expect(mock.tableCalls).toHaveLength(0);
  });

  it("delega en la RPC transaccional con los 3 parámetros", async () => {
    mock.setRpcResult("crm_propagar_conversion_cliente", { data: {}, error: null });
    await propagarConversionProspectoCRM({
      oportunidadId: "op-1",
      clienteId: "c-1",
      clienteNombre: "Acme",
    });
    const rpc = mock.rpcCalls.find((c) => c.fn === "crm_propagar_conversion_cliente");
    expect(rpc).toBeDefined();
    expect(rpc?.args).toMatchObject({
      p_oportunidad_id: "op-1",
      p_cliente_id: "c-1",
      p_cliente_nombre: "Acme",
    });
    // Ya no hay escrituras sueltas a las tablas del CRM.
    expect(mock.tableCalls.map((c) => c.table)).not.toContain("crm_oportunidades");
  });

  it("propaga el error de la RPC crm_propagar_conversion_cliente", async () => {
    mock.setRpcResult("crm_propagar_conversion_cliente", {
      data: null,
      error: { message: "LC_ORG_AJENA" },
    });
    await expect(
      propagarConversionProspectoCRM({ oportunidadId: "op-1", clienteId: "c-1", clienteNombre: "X" }),
    ).rejects.toThrow(/LC_ORG_AJENA/);
  });
});
