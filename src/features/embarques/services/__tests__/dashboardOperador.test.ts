import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchDocsFaltantesOperador, fetchSinTrackingOperador } from "../dashboardOperador";

const EMAIL = "op@x.com";
const DAY = 86_400_000;

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("fetchDocsFaltantesOperador", () => {
  it("retorna [] cuando no hay embarques", async () => {
    mock.setTableResult("embarques", { data: [], error: null });
    expect(await fetchDocsFaltantesOperador(EMAIL)).toEqual([]);
  });

  it("cuenta documentos pendientes por embarque y filtra los que tienen 0", async () => {
    mock.setTableResult("embarques", {
      data: [
        { id: "e1", expediente: "EXP-1", cliente_nombre: "A", estado: "En Tránsito", eta: "2026-03-01" },
        { id: "e2", expediente: "EXP-2", cliente_nombre: "B", estado: "Arribo", eta: null },
      ],
      error: null,
    });
    mock.setTableResult("documentos_embarque", {
      data: [
        { embarque_id: "e1", estado: "Pendiente" },
        { embarque_id: "e1", estado: "Pendiente" },
      ],
      error: null,
    });
    const res = await fetchDocsFaltantesOperador(EMAIL);
    expect(res).toHaveLength(1);
    expect(res[0].id).toBe("e1");
    expect(res[0].pendientes).toBe(2);
  });

  it("ordena por pendientes descendente", async () => {
    mock.setTableResult("embarques", {
      data: [
        { id: "e1", expediente: "X1", cliente_nombre: "A", estado: "En Tránsito", eta: null },
        { id: "e2", expediente: "X2", cliente_nombre: "B", estado: "En Tránsito", eta: null },
      ],
      error: null,
    });
    mock.setTableResult("documentos_embarque", {
      data: [
        { embarque_id: "e1", estado: "Pendiente" },
        { embarque_id: "e2", estado: "Pendiente" },
        { embarque_id: "e2", estado: "Pendiente" },
        { embarque_id: "e2", estado: "Pendiente" },
      ],
      error: null,
    });
    const res = await fetchDocsFaltantesOperador(EMAIL);
    expect(res.map(r => r.id)).toEqual(["e2", "e1"]);
  });

  it("dashboardOperador: propaga error de embarques", async () => {
    mock.setTableResult("embarques", { data: null, error: new Error("boom") });
    await expect(fetchDocsFaltantesOperador(EMAIL)).rejects.toThrow("boom");
  });

  it("filtra por operador con eq + estados activos con in", async () => {
    mock.setTableResult("embarques", { data: [], error: null });
    await fetchDocsFaltantesOperador(EMAIL);
    const call = mock.tableCalls.find(c => c.table === "embarques");
    expect(call?.ops).toContain("eq");
    expect(call?.ops).toContain("in");
  });
});

describe("fetchSinTrackingOperador", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-02-01T00:00:00.000Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("flag proximoArribo=true cuando ETA es en ≤2 días y último evento es viejo", async () => {
    const ahora = new Date("2026-02-01T00:00:00.000Z").getTime();
    mock.setTableResult("embarques", {
      data: [{ id: "e1", expediente: "EXP-1", cliente_nombre: "A", estado: "En Tránsito",
        eta: new Date(ahora + 1 * DAY).toISOString() }],
      error: null,
    });
    mock.setTableResult("eventos_embarque", {
      data: [{ embarque_id: "e1", fecha: new Date(ahora - 10 * DAY).toISOString() }],
      error: null,
    });
    const res = await fetchSinTrackingOperador(EMAIL);
    expect(res[0].proximoArribo).toBe(true);
    expect(res[0].diasSinUpdate).toBeGreaterThanOrEqual(10);
  });

  it("incluye embarques sin eventos (diasSinUpdate=null)", async () => {
    mock.setTableResult("embarques", {
      data: [{ id: "e2", expediente: "X", cliente_nombre: "B", estado: "En Tránsito", eta: null }],
      error: null,
    });
    mock.setTableResult("eventos_embarque", { data: [], error: null });
    const res = await fetchSinTrackingOperador(EMAIL);
    expect(res).toHaveLength(1);
    expect(res[0].diasSinUpdate).toBeNull();
  });

  it("filtra embarques con tracking reciente y sin alerta de pre-arribo", async () => {
    const ahora = Date.now();
    mock.setTableResult("embarques", {
      data: [{ id: "e3", expediente: "X", cliente_nombre: "C", estado: "En Tránsito",
        eta: new Date(ahora + 30 * DAY).toISOString() }],
      error: null,
    });
    mock.setTableResult("eventos_embarque", {
      data: [{ embarque_id: "e3", fecha: new Date(ahora - 1 * DAY).toISOString() }],
      error: null,
    });
    const res = await fetchSinTrackingOperador(EMAIL);
    expect(res).toHaveLength(0);
  });

  it("ordena proximoArribo primero, luego por diasSinUpdate desc", async () => {
    const ahora = Date.now();
    mock.setTableResult("embarques", {
      data: [
        { id: "a", expediente: "A", cliente_nombre: "", estado: "En Tránsito",
          eta: new Date(ahora + 30 * DAY).toISOString() },
        { id: "b", expediente: "B", cliente_nombre: "", estado: "En Tránsito",
          eta: new Date(ahora + 1 * DAY).toISOString() },
      ],
      error: null,
    });
    mock.setTableResult("eventos_embarque", {
      data: [
        { embarque_id: "a", fecha: new Date(ahora - 20 * DAY).toISOString() },
        { embarque_id: "b", fecha: new Date(ahora - 10 * DAY).toISOString() },
      ],
      error: null,
    });
    const res = await fetchSinTrackingOperador(EMAIL);
    expect(res[0].id).toBe("b");
  });
});
