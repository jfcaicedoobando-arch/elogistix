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
  it("cliente nuevo + etapa abierta + oportunidad → devuelve ids", async () => {
    mock.setTableResult("clientes", { data: { id: "cli-new", nombre: "Beta SA" }, error: null });
    mock.setTableResult("crm_etapas_pipeline", { data: { id: "et-1", probabilidad_default: 30 }, error: null });
    mock.setTableResult("crm_oportunidades", { data: { id: "op-1" }, error: null });
    mock.setTableResult("crm_leads", { data: null, error: null });

    const r = await convertirLead(baseParams, user);
    expect(r).toEqual({ clienteId: "cli-new", oportunidadId: "op-1" });
    
    const opPayload = mock.getMutationPayload("crm_oportunidades", "insert") as any;
    expect(opPayload.probabilidad).toBe(30);
    expect(opPayload.vendedor_id).toBe("usr-1");
  });

  it("usa fallbacks para probabilidad, cierre, vendedor, modo y created_by", async () => {
    mock.setTableResult("clientes", { data: { id: "c1", nombre: "N" }, error: null });
    mock.setTableResult("crm_etapas_pipeline", { data: { id: "e1", probabilidad_default: null }, error: null });
    mock.setTableResult("crm_oportunidades", { data: { id: "op1" }, error: null });
    mock.setTableResult("crm_leads", { data: null, error: null });

    await convertirLead({
      lead: { id: "l1", empresa: "B" } as any,
      crearCliente: true,
      nombreOportunidad: "Op",
      montoEstimado: 100,
      moneda: "MXN",
    }, null);

    const opPayload = mock.getMutationPayload("crm_oportunidades", "insert") as any;
    expect(opPayload.probabilidad).toBe(0);
    expect(opPayload.fecha_estimada_cierre).toBeNull();
    expect(opPayload.vendedor_id).toBeNull();
    expect(opPayload.vendedor_email).toBe("");
    expect(opPayload.modo).toBe("");
    expect(opPayload.created_by).toBeNull();
  });

  it("usa user id/email si el lead no los tiene", async () => {
    mock.setTableResult("clientes", { data: { id: "c1", nombre: "N" }, error: null });
    mock.setTableResult("crm_etapas_pipeline", { data: { id: "e1" }, error: null });
    mock.setTableResult("crm_oportunidades", { data: { id: "op1" }, error: null });
    mock.setTableResult("crm_leads", { data: null, error: null });

    await convertirLead({
      lead: { id: "l1", empresa: "B" } as any,
      crearCliente: true,
      nombreOportunidad: "Op",
      montoEstimado: 100,
      moneda: "MXN",
    }, { id: "u2", email: "u2@x.com" });

    const opPayload = mock.getMutationPayload("crm_oportunidades", "insert") as any;
    expect(opPayload.vendedor_id).toBe("u2");
    expect(opPayload.vendedor_email).toBe("u2@x.com");
    expect(opPayload.created_by).toBe("u2");
  });

  it("propaga error al actualizar lead", async () => {
    mock.setTableResult("clientes", { data: { id: "c", nombre: "X" }, error: null });
    mock.setTableResult("crm_etapas_pipeline", { data: { id: "e" }, error: null });
    mock.setTableResult("crm_oportunidades", { data: { id: "o" }, error: null });
    mock.setTableResult("crm_leads", { data: null, error: { message: "lead update fail" } });
    
    await expect(convertirLead(baseParams, user)).rejects.toThrow("lead update fail");
  });
});
