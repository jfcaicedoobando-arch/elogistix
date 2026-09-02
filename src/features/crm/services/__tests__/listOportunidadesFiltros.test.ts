/**
 * v13.823.49 — los filtros de etapa, vendedor, rango de cierre y monto mínimo
 * deben viajar a la consulta (antes se aplicaban en memoria sobre 500 filas) y
 * la exportación debe leer TODAS las páginas con los mismos filtros.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const state: {
  eqs: Array<[string, string]>;
  gtes: Array<[string, string | number]>;
  ltes: Array<[string, string | number]>;
  ranges: Array<[number, number]>;
  ors: string[];
} = { eqs: [], gtes: [], ltes: [], ranges: [], ors: [] };

/** Filas por lote devueltas por `.range()` (simula PostgREST). */
let filasPorLote: number[] = [0];
let loteIdx = 0;

const builder: Record<string, unknown> = {
  select: vi.fn(() => builder),
  order: vi.fn(() => builder),
  is: vi.fn(() => builder),
  not: vi.fn(() => builder),
  or: vi.fn((f: string) => { state.ors.push(f); return builder; }),
  eq: vi.fn((c: string, v: string) => { state.eqs.push([c, v]); return builder; }),
  gte: vi.fn((c: string, v: string | number) => { state.gtes.push([c, v]); return builder; }),
  lte: vi.fn((c: string, v: string | number) => { state.ltes.push([c, v]); return builder; }),
  range: vi.fn((from: number, to: number) => {
    state.ranges.push([from, to]);
    const n = filasPorLote[loteIdx] ?? 0;
    loteIdx += 1;
    const data = Array.from({ length: n }, (_, i) => ({ id: `op-${from + i}` }));
    return Promise.resolve({ data, count: 1200, error: null });
  }),
};

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: vi.fn(() => builder) },
}));

import { listOportunidades, listOportunidadesTodas } from "@/features/crm/services/oportunidades";

beforeEach(() => {
  state.eqs = []; state.gtes = []; state.ltes = []; state.ranges = []; state.ors = [];
  filasPorLote = [0];
  loteIdx = 0;
});

describe("listOportunidades — filtros server-side", () => {
  it("manda etapa, vendedor, rango de cierre y monto mínimo a la consulta", async () => {
    await listOportunidades({
      search: "", etapaId: "e-1", vendedorId: "v-1",
      cierreDesde: "2026-01-01", cierreHasta: "2026-03-31", montoMin: 5000,
      page: 0, pageSize: 500,
    });
    expect(state.eqs).toEqual(expect.arrayContaining([["etapa_id", "e-1"], ["vendedor_id", "v-1"]]));
    expect(state.gtes).toEqual(expect.arrayContaining([
      ["fecha_estimada_cierre", "2026-01-01"],
      ["monto_estimado", 5000],
    ]));
    expect(state.ltes).toEqual([["fecha_estimada_cierre", "2026-03-31"]]);
    expect(state.ranges).toEqual([[0, 499]]);
  });

  it("omite filtros en sus valores neutros", async () => {
    await listOportunidades({
      search: "", etapaId: "todas", vendedorId: "todos", montoMin: null,
      page: 1, pageSize: 50,
    });
    expect(state.eqs).toEqual([]);
    expect(state.gtes).toEqual([]);
    expect(state.ranges).toEqual([[50, 99]]);
  });
});

describe("listOportunidadesTodas — exportación completa", () => {
  it("lee todas las páginas conservando los filtros", async () => {
    filasPorLote = [1000, 200];
    const filas = await listOportunidadesTodas({
      search: "acme", etapaId: "e-9", vendedorId: "todos", montoMin: 100,
    });
    expect(filas).toHaveLength(1200);
    expect(state.ranges).toEqual([[0, 999], [1000, 1999]]);
    expect(state.eqs).toEqual(expect.arrayContaining([["etapa_id", "e-9"]]));
    expect(state.gtes).toEqual(expect.arrayContaining([["monto_estimado", 100]]));
    expect(state.ors).toHaveLength(2);
  });
});
