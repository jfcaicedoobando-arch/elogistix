/**
 * `listActividades` (services/crm/actividades) — contrato de orden y filtros
 * server-side. Cubre Ola 2 del plan de filtros globales.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { listActividades } from "@/features/crm/services/actividades";

const state: {
  order: [string, { ascending: boolean; nullsFirst: boolean }] | null;
  eqs: Array<[string, string]>;
  ilike: [string, string] | null;
  isNull: [string, null] | null;
  notNull: [string, string, null] | null;
  range: [number, number] | null;
} = { order: null, eqs: [], ilike: null, isNull: null, notNull: null, range: null };

const builder: Record<string, unknown> = {
  select: vi.fn().mockReturnThis(),
  order: vi.fn((col: string, opts: { ascending: boolean; nullsFirst: boolean }) => {
    state.order = [col, opts];
    return builder;
  }),
  ilike: vi.fn((col: string, v: string) => {
    state.ilike = [col, v];
    return builder;
  }),
  eq: vi.fn((col: string, v: string) => {
    state.eqs.push([col, v]);
    return builder;
  }),
  is: vi.fn((col: string, v: null) => {
    state.isNull = [col, v];
    return builder;
  }),
  not: vi.fn((col: string, op: string, v: null) => {
    state.notNull = [col, op, v];
    return builder;
  }),
  range: vi.fn((from: number, to: number) => {
    state.range = [from, to];
    return Promise.resolve({ data: [], count: 0, error: null });
  }),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(() => builder) },
}));

beforeEach(() => {
  state.order = null;
  state.eqs = [];
  state.ilike = null;
  state.isNull = null;
  state.notNull = null;
  state.range = null;
});

describe("listActividades — contrato server-side", () => {
  const base = { search: "", tipo: "todos", estado: "todas", responsable: "todos", page: 0, pageSize: 25 } as const;

  it("aplica orden por default fecha_programada asc con nullsFirst=false y range de la página", async () => {
    await listActividades(base);
    expect(state.order).toEqual(["fecha_programada", { ascending: true, nullsFirst: false }]);
    expect(state.range).toEqual([0, 24]);
  });

  it("respeta sortKey/sortDir custom y range de páginas siguientes", async () => {
    await listActividades({ ...base, page: 3, pageSize: 20, sortKey: "asunto", sortDir: "desc" });
    expect(state.order).toEqual(["asunto", { ascending: false, nullsFirst: false }]);
    expect(state.range).toEqual([60, 79]);
  });

  it("estado=pendientes usa is(fecha_completada, null)", async () => {
    await listActividades({ ...base, estado: "pendientes" });
    expect(state.isNull).toEqual(["fecha_completada", null]);
    expect(state.notNull).toBeNull();
  });

  it("estado=completadas usa not(fecha_completada, is, null)", async () => {
    await listActividades({ ...base, estado: "completadas" });
    expect(state.notNull).toEqual(["fecha_completada", "is", null]);
    expect(state.isNull).toBeNull();
  });

  it("responsable=mias con userId agrega eq(responsable_id, userId)", async () => {
    await listActividades({ ...base, responsable: "mias", userId: "usr-1" });
    expect(state.eqs).toContainEqual(["responsable_id", "usr-1"]);
  });

  it("responsable=mias sin userId no agrega filtro", async () => {
    await listActividades({ ...base, responsable: "mias" });
    expect(state.eqs.find(([k]) => k === "responsable_id")).toBeUndefined();
  });

  it("aplica búsqueda con ilike sobre asunto", async () => {
    await listActividades({ ...base, search: "  llamar cliente  " });
    expect(state.ilike).toEqual(["asunto", "%llamar cliente%"]);
  });
});
