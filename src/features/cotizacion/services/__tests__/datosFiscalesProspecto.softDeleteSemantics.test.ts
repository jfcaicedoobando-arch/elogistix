import { beforeEach, describe, expect, it, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSimpleFilteredReadMock } = await import("@/services/__tests__/_simpleFilteredReadMock");
  return createSimpleFilteredReadMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchDatosFiscalesProspecto } from "../datosFiscalesProspecto";

const vacio = { rfc: "", direccion: "", ciudad: "", estado: "", cp: "" };
const oportunidad = { id: "op-test", lead_id: "lead-test", deleted_at: null };
const lead = {
  id: "lead-test", deleted_at: null, rfc: "RFC-FICTICIO", direccion: "Dirección de prueba",
  ciudad: "Ciudad de prueba", entidad_federativa: "Estado de prueba", cp: "00000",
};
const lecturaOportunidad = {
  table: "crm_oportunidades", ops: ["select", "eq", "is"],
  opArgs: [["lead_id"], ["id", "op-test"], ["deleted_at", null]],
};
const lecturaLead = {
  table: "crm_leads", ops: ["select", "eq", "is"],
  opArgs: [["rfc, direccion, ciudad, entidad_federativa, cp"], ["id", "lead-test"], ["deleted_at", null]],
};

beforeEach(() => {
  mock.reset();
  mock.source("crm_oportunidades", oportunidad);
  mock.source("crm_leads", lead);
});

describe("precarga fiscal: sólo oportunidad y lead vigentes, sin mutaciones", () => {
  it.each([null, ""])("sin oportunidad (%j) devuelve VACIO sin consultas", async id => {
    expect(await fetchDatosFiscalesProspecto(id)).toEqual(vacio);
    expect(mock.tableCalls).toEqual([]);
    expect(mock.rpcCalls).toEqual([]);
  });

  it("la cadena vigente conserva campos, identidad y proyecciones", async () => {
    expect(await fetchDatosFiscalesProspecto("op-test")).toEqual({
      rfc: lead.rfc, direccion: lead.direccion, ciudad: lead.ciudad, estado: lead.entidad_federativa, cp: lead.cp,
    });
    expect(mock.tableCalls).toEqual([lecturaOportunidad, lecturaLead]);
    expect(mock.rpcCalls).toEqual([]);
  });

  it.each([
    { caso: "eliminada", row: { ...oportunidad, deleted_at: "2026-10-01T00:00:00Z" } },
    { caso: "ausente", row: null },
    { caso: "otra identidad", row: { ...oportunidad, id: "op-otra" } },
    { caso: "sin lead", row: { ...oportunidad, lead_id: null } },
    { caso: "lead vacío", row: { ...oportunidad, lead_id: "" } },
  ])("oportunidad $caso devuelve VACIO sin consultar el lead", async ({ row }) => {
    mock.source("crm_oportunidades", row);
    expect(await fetchDatosFiscalesProspecto("op-test")).toEqual(vacio);
    expect(mock.tableCalls).toEqual([lecturaOportunidad]);
    expect(mock.rpcCalls).toEqual([]);
  });

  it.each([null, oportunidad])("error de oportunidad devuelve VACIO aun con datos (%j) sin leer lead", async row => {
    mock.source("crm_oportunidades", row, { message: "fallo-oportunidad", code: "P0001" });
    expect(await fetchDatosFiscalesProspecto("op-test")).toEqual(vacio);
    expect(mock.tableCalls).toEqual([lecturaOportunidad]);
    expect(mock.rpcCalls).toEqual([]);
  });

  it.each([
    { caso: "eliminado", row: { ...lead, deleted_at: "2026-10-01T00:00:00Z" } },
    { caso: "ausente", row: null },
    { caso: "otra identidad", row: { ...lead, id: "lead-otro" } },
  ])("lead $caso devuelve VACIO", async ({ row }) => {
    mock.source("crm_leads", row);
    expect(await fetchDatosFiscalesProspecto("op-test")).toEqual(vacio);
    expect(mock.tableCalls).toEqual([lecturaOportunidad, lecturaLead]);
    expect(mock.rpcCalls).toEqual([]);
  });

  it.each([null, lead])("error de lead conserva falla suave aunque traiga datos (%j)", async row => {
    mock.source("crm_leads", row, { message: "fallo-lead", code: "P0001" });
    expect(await fetchDatosFiscalesProspecto("op-test")).toEqual(vacio);
    expect(mock.tableCalls).toEqual([lecturaOportunidad, lecturaLead]);
    expect(mock.rpcCalls).toEqual([]);
  });

  it("campos nulos del lead vigente se normalizan a cadenas vacías", async () => {
    mock.source("crm_leads", {
      ...lead, rfc: null, direccion: null, ciudad: null, entidad_federativa: null, cp: null,
    });
    expect(await fetchDatosFiscalesProspecto("op-test")).toEqual(vacio);
    expect(mock.tableCalls).toEqual([lecturaOportunidad, lecturaLead]);
    expect(mock.rpcCalls).toEqual([]);
  });

  it("VACIO conserva el mismo contrato para ausencia, oportunidad y lead eliminados", async () => {
    const sinOportunidad = await fetchDatosFiscalesProspecto(null);
    mock.source("crm_oportunidades", { ...oportunidad, deleted_at: "2026-10-01" });
    expect(await fetchDatosFiscalesProspecto("op-test")).toBe(sinOportunidad);
    mock.source("crm_oportunidades", oportunidad);
    mock.source("crm_leads", { ...lead, deleted_at: "2026-10-01" });
    expect(await fetchDatosFiscalesProspecto("op-test")).toBe(sinOportunidad);
  });
});
