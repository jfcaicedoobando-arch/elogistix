import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { buscarProspectos } from "@/features/crm/services/prospectoSearch";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("services/crm/prospectoSearch", () => {
  it("devuelve [] cuando ambas fuentes vienen vacías", async () => {
    mock.setTableResult("crm_leads", { data: [], error: null });
    mock.setTableResult("crm_oportunidades", { data: [], error: null });
    expect(await buscarProspectos("acme")).toEqual([]);
  });

  it("mapea leads a kind=lead", async () => {
    mock.setTableResult("crm_leads", {
      data: [{ id: "l1", empresa: "ACME", contacto: "Juan", email: "j@a", telefono: "555" }],
      error: null,
    });
    mock.setTableResult("crm_oportunidades", { data: [], error: null });
    const r = await buscarProspectos("acme");
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ kind: "lead", empresa: "ACME", contacto: "Juan" });
  });

  it("mapea oportunidades con etapa objeto", async () => {
    mock.setTableResult("crm_leads", { data: [], error: null });
    mock.setTableResult("crm_oportunidades", {
      data: [{ id: "o1", nombre: "Op", lead_id: "l1", cliente_nombre: "Cli", etapa: { nombre: "Calificado" } }],
      error: null,
    });
    const r = await buscarProspectos("op");
    expect(r[0]).toMatchObject({ kind: "oportunidad", empresa: "Cli", etapaNombre: "Calificado", leadId: "l1" });
  });

  it("mapea oportunidades con etapa como array", async () => {
    mock.setTableResult("crm_leads", { data: [], error: null });
    mock.setTableResult("crm_oportunidades", {
      data: [{ id: "o1", nombre: "Op", lead_id: null, cliente_nombre: null, etapa: [{ nombre: "Inicial" }] }],
      error: null,
    });
    const r = await buscarProspectos("op");
    expect(r[0].etapaNombre).toBe("Inicial");
    expect(r[0].empresa).toBe("Op");
  });

  it("oportunidad usa nombre cuando cliente_nombre es null", async () => {
    mock.setTableResult("crm_leads", { data: [], error: null });
    mock.setTableResult("crm_oportunidades", {
      data: [{ id: "o1", nombre: "Solo nombre", lead_id: null, cliente_nombre: null, etapa: null }],
      error: null,
    });
    const r = await buscarProspectos("x");
    expect(r[0].empresa).toBe("Solo nombre");
  });

  it("normaliza contacto/email/telefono a '' cuando null en lead", async () => {
    mock.setTableResult("crm_leads", {
      data: [{ id: "l1", empresa: "X", contacto: null, email: null, telefono: null }],
      error: null,
    });
    mock.setTableResult("crm_oportunidades", { data: [], error: null });
    const r = await buscarProspectos("x");
    expect(r[0]).toMatchObject({ contacto: "", email: "", telefono: "" });
  });

  it("propaga error de crm_leads", async () => {
    mock.setTableResult("crm_leads", { data: null, error: { message: "x" } });
    mock.setTableResult("crm_oportunidades", { data: [], error: null });
    await expect(buscarProspectos("x")).rejects.toThrow();
  });

  it("propaga error de crm_oportunidades", async () => {
    mock.setTableResult("crm_leads", { data: [], error: null });
    mock.setTableResult("crm_oportunidades", { data: null, error: { message: "x" } });
    await expect(buscarProspectos("x")).rejects.toThrow();
  });

  it("limita resultados a 8 por fuente", async () => {
    mock.setTableResult("crm_leads", { data: [], error: null });
    mock.setTableResult("crm_oportunidades", { data: [], error: null });
    await buscarProspectos("x");
    const leadCall = mock.tableCalls.find((c) => c.table === "crm_leads")!;
    const idx = leadCall.ops.indexOf("limit");
    expect(leadCall.opArgs[idx]).toEqual([8]);
  });

  it("sólo admite leads Calificado/Prospecto (excluye Nuevo, Descalificado y Convertido)", async () => {
    mock.setTableResult("crm_leads", { data: [], error: null });
    mock.setTableResult("crm_oportunidades", { data: [], error: null });
    await buscarProspectos("x");
    const leadCall = mock.tableCalls.find((c) => c.table === "crm_leads")!;
    const inIdx = leadCall.ops.indexOf("in");
    expect(leadCall.opArgs[inIdx]).toEqual(["estado", ["Calificado", "Prospecto"]]);
  });

  it("combina resultados de leads + oportunidades", async () => {
    mock.setTableResult("crm_leads", {
      data: [{ id: "l1", empresa: "L", contacto: "c", email: "e", telefono: "t" }],
      error: null,
    });
    mock.setTableResult("crm_oportunidades", {
      data: [{ id: "o1", nombre: "O", lead_id: null, cliente_nombre: "C", etapa: null }],
      error: null,
    });
    const r = await buscarProspectos("x");
    expect(r).toHaveLength(2);
    expect(r.map((x) => x.kind)).toEqual(["lead", "oportunidad"]);
  });
});
