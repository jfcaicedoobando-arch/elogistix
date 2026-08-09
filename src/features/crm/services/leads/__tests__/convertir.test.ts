import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { convertirLead, type ConvertirLeadParams } from "../convertir";
import type { CrmLeadRow } from "@/features/crm/domain/leads/constants";

const lead = {
  id: "lead-1",
  empresa: "Beta SA",
  email: "x@y.com",
  telefono: "555",
  ciudad: "CDMX",
  contacto: "Juan",
  vendedor_id: "usr-1",
  vendedor_email: "v@x.com",
  interes_modo: "Aéreo",
} as CrmLeadRow;

const baseParams: ConvertirLeadParams = {
  lead,
  crearCliente: true,
  clienteIdExistente: null,
  nombreOportunidad: "Embarque Q1",
  montoEstimado: 15000,
  moneda: "USD",
  fechaEstimadaCierre: "2026-12-31",
};

const user = { id: "usr-1", email: "v@x.com" };

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
  mock.resetResults();
});

describe("convertirLead", () => {
  it("Ola 6 · M4: delega en la RPC atómica y devuelve los ids", async () => {
    mock.setRpcResult("convertir_lead_rpc", {
      data: { cliente_id: "cli-new", oportunidad_id: "op-1", creado: true },
      error: null,
    });

    const r = await convertirLead(baseParams, user);
    expect(r).toEqual({ clienteId: "cli-new", oportunidadId: "op-1" });

    const call = mock.rpcCalls.find((c) => c.fn === "convertir_lead_rpc");
    expect(call?.args).toMatchObject({
      p_lead_id: "lead-1",
      p_crear_cliente: true,
      p_cliente_id: null,
      p_nombre_oportunidad: "Embarque Q1",
      p_monto_estimado: 15000,
      p_moneda: "USD",
      p_fecha_estimada_cierre: "2026-12-31",
    });
  });

  it("es idempotente: lead ya convertido devuelve los ids existentes", async () => {
    mock.setRpcResult("convertir_lead_rpc", {
      data: { cliente_id: null, oportunidad_id: "op-prev", creado: false },
      error: null,
    });
    const r = await convertirLead(baseParams, user);
    expect(r).toEqual({ clienteId: null, oportunidadId: "op-prev" });
  });

  it("convertirLead propaga el error de convertir_lead_rpc", async () => {
    mock.setRpcResult("convertir_lead_rpc", { data: null, error: { message: "lead update fail" } });
    await expect(convertirLead(baseParams, user)).rejects.toThrow(/lead update fail/);
  });

  it("lanza si la RPC no devuelve oportunidad", async () => {
    mock.setRpcResult("convertir_lead_rpc", { data: {}, error: null });
    await expect(convertirLead(baseParams, user)).rejects.toThrow(/No se pudo convertir el lead/);
  });
});
