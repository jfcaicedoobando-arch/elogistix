import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  resolveClienteForConversion,
  fetchPrimeraEtapaAbierta,
  convertirLead,
  type ConvertirLeadParams,
} from "../convertir";
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

describe("resolveClienteForConversion", () => {
  it("crearCliente=true usa fallbacks para campos opcionales", async () => {
    mock.setTableResult("clientes", { data: { id: "c1", nombre: "N" }, error: null });
    await resolveClienteForConversion({
      lead: { empresa: "Beta" } as any,
      crearCliente: true,
    });
    const payload = mock.getMutationPayload("clientes", "insert") as any;
    expect(payload.email).toBe("");
    expect(payload.telefono).toBe("");
    expect(payload.ciudad).toBe("");
    expect(payload.contacto).toBe("");
  });

  it("crearCliente=true sin existente → inserta y devuelve id/nombre del nuevo", async () => {
    mock.setTableResult("clientes", {
      data: { id: "cli-new", nombre: "Beta SA" },
      error: null,
    });
    const r = await resolveClienteForConversion({
      lead,
      crearCliente: true,
      clienteIdExistente: null,
    });
    expect(r).toEqual({ clienteId: "cli-new", clienteNombre: "Beta SA" });
  });

  it("clienteIdExistente provisto → no inserta, consulta nombre", async () => {
    mock.setTableResult("clientes", { data: { nombre: "Acme" }, error: null });
    const r = await resolveClienteForConversion({
      lead,
      crearCliente: false,
      clienteIdExistente: "cli-exist",
    });
    expect(r).toEqual({ clienteId: "cli-exist", clienteNombre: "Acme" });
  });

  it("ni crear ni existente → devuelve clienteId null", async () => {
    const r = await resolveClienteForConversion({
      lead,
      crearCliente: false,
      clienteIdExistente: null,
    });
    expect(r).toEqual({ clienteId: null, clienteNombre: "" });
  });

  it("propaga error al insertar cliente", async () => {
    mock.setTableResult("clientes", { data: null, error: { message: "RLS" } });
    await expect(
      resolveClienteForConversion({ lead, crearCliente: true, clienteIdExistente: null }),
    ).rejects.toThrow();
  });

  it("clienteIdExistente con consulta sin data → usa lead.empresa como fallback", async () => {
    mock.setTableResult("clientes", { data: null, error: null });
    const r = await resolveClienteForConversion({
      lead,
      crearCliente: false,
      clienteIdExistente: "cli-x",
    });
    expect(r.clienteNombre).toBe("Beta SA");
  });
});

describe("fetchPrimeraEtapaAbierta", () => {
  it("devuelve la etapa cuando existe", async () => {
    mock.setTableResult("crm_etapas_pipeline", {
      data: { id: "et-1", probabilidad_default: 25 },
      error: null,
    });
    const r = await fetchPrimeraEtapaAbierta();
    expect(r).toEqual({ id: "et-1", probabilidad_default: 25 });
  });

  it("lanza cuando no hay etapas abiertas configuradas", async () => {
    mock.setTableResult("crm_etapas_pipeline", { data: null, error: null });
    await expect(fetchPrimeraEtapaAbierta()).rejects.toThrow(/etapas abiertas/);
  });
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
