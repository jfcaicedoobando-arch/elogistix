/**
 * Tests for src/services/embarque/eventos.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchEventosEmbarque, insertEventoEmbarque } from "@/features/embarques/services/eventos";

const EMBARQUE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

// v13.137.35: reset de `tableCalls` por test (consistente con forecast/leaderboard
// /plantillas/proyeccion). Sin esto, `tableCalls.find(...)` y `tableCalls[tableCalls.length - 1]`
// pueden leer llamadas de tests previos si se reordena la suite.
beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
  mock.resetResults();
});

describe("fetchEventosEmbarque", () => {
  it("queries eventos_embarque filtered by embarque_id", async () => {
    mock.setTableResult("eventos_embarque", { data: [], error: null });
    const result = await fetchEventosEmbarque(EMBARQUE_ID);
    expect(result).toEqual([]);
    const call = mock.tableCalls.find((c) => c.table === "eventos_embarque");
    expect(call).toMatchObject({ table: "eventos_embarque" });
    expect(call?.ops).toEqual(expect.arrayContaining(["select", "eq", "order"]));
  });

  it("returns mapped rows when data exists", async () => {
    const row = {
      id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
      embarque_id: EMBARQUE_ID,
      tipo: "arribo",
      descripcion: "Llegó al puerto",
      ubicacion: "Manzanillo",
      fecha: "2024-06-01T00:00:00Z",
      usuario: "agent@demo.com",
      created_at: "2024-06-01T00:00:00Z",
    };
    mock.setTableResult("eventos_embarque", { data: [row], error: null });
    const result = await fetchEventosEmbarque(EMBARQUE_ID);
    expect(result).toHaveLength(1);
    expect(result[0]?.tipo).toBe("arribo");
  });

  it("throws when insertEventoEmbarque supabase returns an error", async () => {
    mock.setTableResult("eventos_embarque", { data: null, error: new Error("db error") });
    await expect(fetchEventosEmbarque(EMBARQUE_ID)).rejects.toThrow("db error");
  });
});

describe("insertEventoEmbarque", () => {
  it("inserts into eventos_embarque without throwing on success", async () => {
    mock.setTableResult("eventos_embarque", { data: null, error: null });
    await expect(
      insertEventoEmbarque({
        embarqueId: EMBARQUE_ID,
        tipo: "zarpe",
        descripcion: "Zarpó del puerto",
        ubicacion: "Veracruz",
        fecha: "2024-06-02T00:00:00Z",
        usuario: "op@demo.com",
      }),
    ).resolves.toBeUndefined();
    // v13.821.2 — Con sesión mockeada el servicio también escribe bitácora;
    // se busca explícitamente la llamada a eventos_embarque.
    const insertCall = mock.tableCalls.find(
      (c) => c.table === "eventos_embarque" && c.ops.includes("insert"),
    );
    expect(insertCall?.table).toBe("eventos_embarque");
    expect(insertCall?.ops).toContain("insert");
  });

  it("throws when supabase insert fails", async () => {
    mock.setTableResult("eventos_embarque", { data: null, error: new Error("insert fail") });
    await expect(
      insertEventoEmbarque({
        embarqueId: EMBARQUE_ID,
        tipo: "estado",
        descripcion: "Cambio",
        ubicacion: "",
        fecha: "2024-06-02T00:00:00Z",
        usuario: "op@demo.com",
      }),
    ).rejects.toThrow("insert fail");
  });

  it("accepts valid tipo_evento_tracking enum values without error", async () => {
    const tiposValidos = ["zarpe", "arribo", "estado", "aduana", "entrega"];
    mock.setTableResult("eventos_embarque", { data: null, error: null });
    for (const tipo of tiposValidos) {
      await expect(
        insertEventoEmbarque({
          embarqueId: EMBARQUE_ID,
          tipo,
          descripcion: `Evento ${tipo}`,
          ubicacion: "Puerto",
          fecha: "2024-06-01T00:00:00Z",
          usuario: "op@demo.com",
        }),
      ).resolves.toBeUndefined();
    }
  });
});
