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
  mock.resetResults();
});

/** Sin borrador previo para la oportunidad (primera consulta a `cotizaciones`). */
function sinBorradorPrevio() {
  mock.setTableResultOnce("cotizaciones", { data: null, error: null });
}

const opBase = {
  id: "op1",
  cliente_id: "cl1" as string | null,
  cliente_nombre: "Cliente SA" as string | null,
  origen: "CNSHA" as string | null,
  destino: "MXZLO" as string | null,
};

describe("insertCotizacionDesdeOportunidad", () => {
  it("inserta payload con datos de la oportunidad y devuelve id", async () => {
    sinBorradorPrevio();
    mock.setTableResult("cotizaciones", { data: { id: "cot1", folio: "F-1" }, error: null });
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
    sinBorradorPrevio();
    mock.setTableResult("cotizaciones", { data: { id: "cot2", folio: "F-2" }, error: null });
    await insertCotizacionDesdeOportunidad({
      folio: "F-2", modo: "Aéreo",
      oportunidad: { ...opBase, cliente_id: null }, operador: "u@x.com",
    });
    const payload = mock.getMutationPayload("cotizaciones", "insert") as Record<string, unknown>;
    expect(payload.es_prospecto).toBe(true);
  });

  it("convierte nulls de origen/destino/cliente_nombre a string vacío", async () => {
    sinBorradorPrevio();
    mock.setTableResult("cotizaciones", { data: { id: "c", folio: "F" }, error: null });
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

  it("v13.823.32: reutiliza el borrador vivo de la oportunidad en lugar de duplicar", async () => {
    mock.setTableResult("cotizaciones", { data: { id: "cot-prev", folio: "F-PREV" }, error: null });
    const r = await insertCotizacionDesdeOportunidad({
      folio: "F-NUEVO", modo: "Marítimo", oportunidad: opBase, operador: "u@x.com",
    });
    expect(r).toEqual({ id: "cot-prev", folio: "F-PREV", reutilizada: true });
    expect(mock.getMutationPayload("cotizaciones", "insert")).toBeFalsy();
  });

  it("cotizacionDesdeOportunidad: propaga error de supabase", async () => {
    sinBorradorPrevio();
    mock.setTableResult("cotizaciones", { data: null, error: new Error("db") });
    await expect(insertCotizacionDesdeOportunidad({
      folio: "F", modo: "Marítimo", oportunidad: opBase, operador: "u",
    })).rejects.toThrow("db");
  });
});

describe("actualizarEtapaOportunidad", () => {
  it("envía update con etapa_id y probabilidad y filtra por id", async () => {
    mock.setTableResult("crm_oportunidades", { data: { id: "op1" }, error: null });
    await actualizarEtapaOportunidad("op1", "et2", 75);
    const payload = mock.getMutationPayload("crm_oportunidades", "update") as Record<string, unknown>;
    expect(payload).toEqual({ etapa_id: "et2", probabilidad: 75 });
    const call = mock.tableCalls.find(c => c.table === "crm_oportunidades");
    expect(call?.ops).toContain("eq");
  });

  it("v13.823.32: 0 filas (RLS/eliminada) no se reporta como éxito", async () => {
    mock.setTableResult("crm_oportunidades", { data: null, error: null });
    await expect(actualizarEtapaOportunidad("op1", "et2", 75)).rejects.toThrow(/no tienes permiso/);
  });

  it("cotizacionDesdeOportunidad: propaga error al crear cotización", async () => {
    mock.setTableResult("crm_oportunidades", { data: null, error: new Error("nope") });
    await expect(actualizarEtapaOportunidad("o", "e", 10)).rejects.toThrow("nope");
  });
});

describe("insertCotizacionDesdeOportunidad · Etapa 4 (identidad de puerto)", () => {
  const opConPuertos = { ...opBase, puerto_origen_id: "p-sha", puerto_destino_id: "p-zlo" };

  it("copia los IDs de puerto en modo Marítimo", async () => {
    sinBorradorPrevio();
    mock.setTableResult("cotizaciones", { data: { id: "c4", folio: "F-4" }, error: null });
    await insertCotizacionDesdeOportunidad({
      folio: "F-4", modo: "Marítimo", oportunidad: opConPuertos, operador: "u@x.com",
    });
    const payload = mock.getMutationPayload("cotizaciones", "insert") as Record<string, unknown>;
    expect(payload.puerto_origen_id).toBe("p-sha");
    expect(payload.puerto_destino_id).toBe("p-zlo");
  });

  it.each(["Aéreo", "Terrestre", "Multimodal"] as const)(
    "fuerza NULL en modo %s",
    async (modo) => {
      sinBorradorPrevio();
      mock.setTableResult("cotizaciones", { data: { id: "c5", folio: "F-5" }, error: null });
      await insertCotizacionDesdeOportunidad({
        folio: "F-5", modo, oportunidad: opConPuertos, operador: "u@x.com",
      });
      const payload = mock.getMutationPayload("cotizaciones", "insert") as Record<string, unknown>;
      expect(payload.puerto_origen_id).toBeNull();
      expect(payload.puerto_destino_id).toBeNull();
    },
  );

  it("al reutilizar el borrador vivo no escribe ruta ni IDs", async () => {
    mock.setTableResult("cotizaciones", { data: { id: "cot-prev", folio: "F-PREV" }, error: null });
    const r = await insertCotizacionDesdeOportunidad({
      folio: "F-6", modo: "Marítimo", oportunidad: opConPuertos, operador: "u@x.com",
    });
    expect(r.reutilizada).toBe(true);
    expect(mock.getMutationPayload("cotizaciones", "insert")).toBeFalsy();
    expect(mock.getMutationPayload("cotizaciones", "update")).toBeFalsy();
  });
});
