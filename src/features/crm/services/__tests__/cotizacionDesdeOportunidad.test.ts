import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  insertCotizacionDesdeOportunidad,
  actualizarEtapaOportunidad,
} from "../cotizacionDesdeOportunidad";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

const opBase = {
  id: "op1",
  cliente_id: "cl1" as string | null,
  cliente_nombre: "Cliente SA" as string | null,
  origen: "CNSHA" as string | null,
  destino: "MXZLO" as string | null,
};

describe("insertCotizacionDesdeOportunidad", () => {
  it("inserta payload con datos de la oportunidad y devuelve id", async () => {
    mock.setTableResult("cotizaciones", { data: { id: "cot1" }, error: null });
    const r = await insertCotizacionDesdeOportunidad({
      folio: "F-1", modo: "Marítimo",
      oportunidad: opBase, operador: "u@x.com",
    });
    expect(r.id).toBe("cot1");
    const payload = mock.getMutationPayload("cotizaciones", "insert") as Record<string, unknown>;
    expect(payload.folio).toBe("F-1");
    expect(payload.modo).toBe("Marítimo");
    expect(payload.tipo).toBe("Importación");
    expect(payload.cliente_id).toBe("cl1");
    expect(payload.oportunidad_id).toBe("op1");
    expect(payload.es_prospecto).toBe(false);
  });

  it("marca es_prospecto=true cuando cliente_id es null", async () => {
    mock.setTableResult("cotizaciones", { data: { id: "cot2" }, error: null });
    await insertCotizacionDesdeOportunidad({
      folio: "F-2", modo: "Aéreo",
      oportunidad: { ...opBase, cliente_id: null }, operador: "u@x.com",
    });
    const payload = mock.getMutationPayload("cotizaciones", "insert") as Record<string, unknown>;
    expect(payload.es_prospecto).toBe(true);
  });

  it("convierte nulls de origen/destino/cliente_nombre a string vacío", async () => {
    mock.setTableResult("cotizaciones", { data: { id: "c" }, error: null });
    await insertCotizacionDesdeOportunidad({
      folio: "F", modo: "Marítimo",
      oportunidad: { id: "o", cliente_id: "x", cliente_nombre: null, origen: null, destino: null },
      operador: "u@x.com",
    });
    const payload = mock.getMutationPayload("cotizaciones", "insert") as Record<string, unknown>;
    expect(payload.cliente_nombre).toBe("");
    expect(payload.origen).toBe("");
    expect(payload.destino).toBe("");
  });

  it("cotizacionDesdeOportunidad: propaga error de supabase", async () => {
    mock.setTableResult("cotizaciones", { data: null, error: new Error("db") });
    await expect(insertCotizacionDesdeOportunidad({
      folio: "F", modo: "Marítimo", oportunidad: opBase, operador: "u",
    })).rejects.toThrow("db");
  });
});

describe("actualizarEtapaOportunidad", () => {
  it("envía update con etapa_id y probabilidad y filtra por id", async () => {
    mock.setTableResult("crm_oportunidades", { data: null, error: null });
    await actualizarEtapaOportunidad("op1", "et2", 75);
    const payload = mock.getMutationPayload("crm_oportunidades", "update") as Record<string, unknown>;
    expect(payload).toEqual({ etapa_id: "et2", probabilidad: 75 });
    const call = mock.tableCalls.find(c => c.table === "crm_oportunidades");
    expect(call?.ops).toContain("eq");
  });

  it("cotizacionDesdeOportunidad: propaga error al crear cotización", async () => {
    mock.setTableResult("crm_oportunidades", { data: null, error: new Error("nope") });
    await expect(actualizarEtapaOportunidad("o", "e", 10)).rejects.toThrow("nope");
  });
});
