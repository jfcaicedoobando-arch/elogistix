/**
 * COT-NEW-01 — los conteos de tabs y KPIs deben usar el MISMO filtro de estado
 * que el listado paginado; si no, el tab dice (10) y la tabla muestra 9.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

interface Respuesta { count: number | null; error: unknown }

const estado = vi.hoisted(() => ({
  llamadas: [] as Array<{ ops: Array<{ op: string; args: unknown[] }> }>,
}));

vi.mock("@/integrations/supabase/client", () => {
  const makeChain = () => {
    const registro = { ops: [] as Array<{ op: string; args: unknown[] }> };
    estado.llamadas.push(registro);
    const chain: Record<string, unknown> = {};
    const paso = (op: string) => (...args: unknown[]) => {
      registro.ops.push({ op, args });
      return chain;
    };
    for (const op of ["select", "eq", "is", "in", "or", "not", "gte"]) chain[op] = paso(op);
    chain.then = (fn: (r: Respuesta) => unknown) =>
      Promise.resolve({ count: 0, error: null }).then(fn);
    return chain;
  };
  return { supabase: { from: () => makeChain() } };
});

const { fetchCotizacionAgregados } = await import("../agregados");

const filtrosNot = () =>
  estado.llamadas.flatMap((l) => l.ops.filter((o) => o.op === "not"));

describe("fetchCotizacionAgregados · vigencia", () => {
  beforeEach(() => {
    estado.llamadas.length = 0;
  });

  it("por defecto excluye Vencida/Archivada en TODOS los conteos", async () => {
    await fetchCotizacionAgregados("org-1", "todas");
    const nots = filtrosNot();
    expect(nots.length).toBeGreaterThan(0);
    for (const n of nots) {
      expect(n.args[0]).toBe("estado");
      expect(String(n.args[2])).toContain("Vencida");
      expect(String(n.args[2])).toContain("Archivada");
    }
  });

  it("con incluirInactivas no aplica el filtro de estado", async () => {
    await fetchCotizacionAgregados("org-1", "todas", true);
    expect(filtrosNot()).toHaveLength(0);
  });
});
