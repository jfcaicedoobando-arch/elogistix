import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchLeadLineage,
  fetchOportunidadCotsLineage,
  fetchEmbarquesByIds,
  fetchLeadResumen,
} from "@/features/crm/services/lineage";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("services/crm/lineage", () => {
  it("fetchLeadLineage devuelve oportunidades", async () => {
    mock.setTableResult("crm_oportunidades", { data: [{ id: "o1" }], error: null });
    const r = await fetchLeadLineage("lead-1");
    expect(r).toHaveLength(1);
  });

  it("fetchLeadLineage devuelve [] con data null", async () => {
    mock.setTableResult("crm_oportunidades", { data: null, error: null });
    expect(await fetchLeadLineage("l1")).toEqual([]);
  });

  it("fetchLeadLineage filtra por lead_id", async () => {
    mock.setTableResult("crm_oportunidades", { data: [], error: null });
    await fetchLeadLineage("lead-xyz");
    const call = mock.tableCalls[0];
    const idx = call.ops.indexOf("eq");
    expect(call.opArgs[idx]).toEqual(["lead_id", "lead-xyz"]);
  });

  it("fetchLeadLineage propaga error", async () => {
    mock.setTableResult("crm_oportunidades", { data: null, error: { message: "x" } });
    await expect(fetchLeadLineage("l1")).rejects.toThrow();
  });

  it("fetchOportunidadCotsLineage filtra deleted_at null", async () => {
    mock.setTableResult("cotizaciones", { data: [{ id: "c1" }], error: null });
    await fetchOportunidadCotsLineage("op-1");
    const call = mock.tableCalls[0];
    const isIdx = call.ops.indexOf("is");
    expect(call.opArgs[isIdx]).toEqual(["deleted_at", null]);
  });

  it("fetchOportunidadCotsLineage propaga error", async () => {
    mock.setTableResult("cotizaciones", { data: null, error: { message: "x" } });
    await expect(fetchOportunidadCotsLineage("op-1")).rejects.toThrow();
  });

  it("fetchOportunidadCotsLineage devuelve [] cuando data null", async () => {
    mock.setTableResult("cotizaciones", { data: null, error: null });
    expect(await fetchOportunidadCotsLineage("op-1")).toEqual([]);
  });

  it("fetchEmbarquesByIds atajo cuando ids vacío (sin query)", async () => {
    const r = await fetchEmbarquesByIds([]);
    expect(r).toEqual([]);
    expect(mock.tableCalls).toHaveLength(0);
  });

  it("fetchEmbarquesByIds usa filtro .in con ids", async () => {
    mock.setTableResult("embarques", { data: [{ id: "e1" }], error: null });
    await fetchEmbarquesByIds(["e1", "e2"]);
    const call = mock.tableCalls[0];
    const inIdx = call.ops.indexOf("in");
    expect(call.opArgs[inIdx]).toEqual(["id", ["e1", "e2"]]);
  });

  it("fetchEmbarquesByIds propaga error", async () => {
    mock.setTableResult("embarques", { data: null, error: { message: "x" } });
    await expect(fetchEmbarquesByIds(["x"])).rejects.toThrow();
  });

  it("fetchLeadResumen devuelve fila", async () => {
    mock.setTableResult("crm_leads", { data: { id: "l1", empresa: "ACME", estado: "Activo" }, error: null });
    const r = await fetchLeadResumen("l1");
    expect(r?.empresa).toBe("ACME");
  });

  it("fetchLeadResumen devuelve null con data null", async () => {
    mock.setTableResult("crm_leads", { data: null, error: null });
    expect(await fetchLeadResumen("l1")).toBeNull();
  });

  it("fetchLeadResumen propaga error", async () => {
    mock.setTableResult("crm_leads", { data: null, error: { message: "x" } });
    await expect(fetchLeadResumen("l1")).rejects.toThrow();
  });
});

describe("fetchLeadResumen · sólo registros vivos (v13.823.120)", () => {
  it("filtra deleted_at nulo al consultar el lead de origen", async () => {
    mock.setTableResult("crm_leads", { data: { id: "l1", empresa: "ACME", estado: "nuevo" }, error: null });
    await fetchLeadResumen("l1");
    const call = mock.tableCalls[0];
    const isIdx = call.ops.indexOf("is");
    expect(call.opArgs[isIdx]).toEqual(["deleted_at", null]);
  });

  it("un lead archivado no se muestra como origen (null)", async () => {
    mock.setTableResult("crm_leads", { data: null, error: null });
    expect(await fetchLeadResumen("l-archivado")).toBeNull();
  });
});
