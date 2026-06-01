/**
 * Tests para conversión Lead → Cliente + Oportunidad.
 */
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
import type { CrmLeadRow } from "@/lib/crm/leads/constants";

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
    expect(mock.tableCalls).toHaveLength(0);
  });

  it("propaga error al insertar cliente", async () => {
    mock.setTableResult("clientes", { data: null, error: { message: "RLS" } });
    await expect(
      resolveClienteForConversion({ lead, crearCliente: true, clienteIdExistente: null }),
    ).rejects.toBeTruthy();
  });

  it("clienteIdExistente con consulta sin data → usa lead.empresa como fallback", async () => {
    mock.setTableResult("clientes", { data: null, error: null });
    const r = await resolveClienteForConversion({
      lead,
      crearCliente: false,
      clienteIdExistente: "cli-x",
    });
    expect(r.clienteNombre).toBe("Beta SA"); // fallback
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

  it("propaga error de Supabase al consultar etapa abierta", async () => {
    mock.setTableResult("crm_etapas_pipeline", { data: null, error: { message: "x" } });
    await expect(fetchPrimeraEtapaAbierta()).rejects.toBeTruthy();
  });
});

describe("convertirLead (integración happy path)", () => {
  it("cliente nuevo + etapa abierta + oportunidad → devuelve ids", async () => {
    // El mock devuelve el mismo resultado para todas las llamadas a la misma tabla;
    // configuramos por tabla la única respuesta usada en el camino feliz.
    mock.setTableResult("clientes", {
      data: { id: "cli-new", nombre: "Beta SA" },
      error: null,
    });
    mock.setTableResult("crm_etapas_pipeline", {
      data: { id: "et-1", probabilidad_default: 30 },
      error: null,
    });
    mock.setTableResult("crm_oportunidades", { data: { id: "op-1" }, error: null });
    mock.setTableResult("crm_leads", { data: null, error: null });

    const r = await convertirLead(baseParams, user);
    expect(r).toEqual({ clienteId: "cli-new", oportunidadId: "op-1" });
  });

  it("propaga error al insertar oportunidad", async () => {
    mock.setTableResult("clientes", { data: { id: "c", nombre: "X" }, error: null });
    mock.setTableResult("crm_etapas_pipeline", {
      data: { id: "et-1", probabilidad_default: 0 },
      error: null,
    });
    mock.setTableResult("crm_oportunidades", { data: null, error: { message: "fail" } });
    await expect(convertirLead(baseParams, user)).rejects.toBeTruthy();
  });
});
