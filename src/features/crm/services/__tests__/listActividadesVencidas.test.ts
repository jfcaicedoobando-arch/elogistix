/**
 * v13.823.49 — `?filtro=vencidas` se resuelve en la consulta: pendiente,
 * responsable actual y `fecha_programada < ahora`. Antes se filtraba en cliente
 * y el `count`/paginación no correspondían al conjunto vencido.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const state: {
  eqs: Array<[string, string]>;
  isNull: Array<[string, unknown]>;
  lts: Array<[string, string]>;
  ors: string[];
} = { eqs: [], isNull: [], lts: [], ors: [] };

const builder: Record<string, unknown> = {
  select: vi.fn(() => builder),
  order: vi.fn(() => builder),
  ilike: vi.fn(() => builder),
  not: vi.fn(() => builder),
  // v13.823.50 — "Mías"/vencidas usa `.or(responsable_id | responsable_email)`.
  or: vi.fn((expr: string) => { state.ors.push(expr); return builder; }),
  eq: vi.fn((c: string, v: string) => { state.eqs.push([c, v]); return builder; }),
  is: vi.fn((c: string, v: unknown) => { state.isNull.push([c, v]); return builder; }),
  lt: vi.fn((c: string, v: string) => { state.lts.push([c, v]); return builder; }),
  range: vi.fn(() => Promise.resolve({ data: [], count: 7, error: null })),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(() => builder) },
}));

import { listActividades } from "@/features/crm/services/actividades";

beforeEach(() => { state.eqs = []; state.isNull = []; state.lts = []; state.ors = []; });

describe("listActividades — vencidas", () => {
  it("filtra pendientes, del responsable y con fecha pasada", async () => {
    const r = await listActividades({
      search: "", tipo: "todos", estado: "pendientes", responsable: "mias",
      page: 0, pageSize: 100, userId: "u-1", vencidas: true,
    });
    expect(r.count).toBe(7);
    expect(state.lts[0]?.[0]).toBe("fecha_programada");
    expect(new Date(state.lts[0]![1]).getTime()).toBeLessThanOrEqual(Date.now());
    expect(state.isNull).toEqual(expect.arrayContaining([["fecha_completada", null]]));
    // v13.823.50: el responsable se filtra por id O correo (filas históricas).
    expect(state.ors.some((o) => o.includes("responsable_id.eq.u-1"))).toBe(true);
  });

  it("sin el flag no añade el filtro de vencidas", async () => {
    await listActividades({
      search: "", tipo: "todos", estado: "todas", responsable: "todos",
      page: 0, pageSize: 100, userId: "u-1",
    });
    expect(state.lts).toEqual([]);
  });
});
