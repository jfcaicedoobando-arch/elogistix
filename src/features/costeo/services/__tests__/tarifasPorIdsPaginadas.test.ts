import { beforeEach, describe, expect, it, vi } from "vitest";
const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyWarning: vi.fn() }));
vi.mock("@/lib/date/today", () => ({ todayLocalISO: () => "2026-10-09" }));
import { fetchTarifasVigentesPorIds } from "../topTarifas";

function consulta(falloLote = -1, duplicarPrimerLote = false) {
  const queries: { ids: string[]; range: ReturnType<typeof vi.fn>; order: ReturnType<typeof vi.fn> }[] = [];
  from.mockImplementation(() => {
    let ids: string[] = [];
    const n = queries.length;
    const q = {
      select: vi.fn().mockReturnThis(),
      in: vi.fn((_column: string, values: string[]) => { ids = values; registro.ids = values; return q; }),
      order: vi.fn().mockReturnThis(),
      range: vi.fn((desde: number, hasta: number) => {
        const rows = duplicarPrimerLote && n === 0 ? Array.from({ length: 1000 }, () => ({ id: ids[0] })) : [...ids].reverse().map((id) => ({ id }));
        return Promise.resolve({ data: rows.slice(desde, hasta + 1), error: n === falloLote ? { message: "falló lote" } : null });
      }),
    };
    const registro = { ids, range: q.range, order: q.order };
    queries.push(registro);
    return q;
  });
  return queries;
}
beforeEach(() => from.mockReset());

describe("tarifas por IDs sin truncado", () => {
  it.each([201, 1001])("recupera %i IDs en lotes acotados, con dedupe y orden original", async (cantidad) => {
    const queries = consulta();
    const ids = Array.from({ length: cantidad }, (_, i) => String(cantidad - i));
    const rows = await fetchTarifasVigentesPorIds([...ids, ids[0]]);
    expect(rows.map((r) => r.id)).toEqual(ids);
    expect(queries).toHaveLength(Math.ceil(cantidad / 200));
    expect(queries.flatMap((q) => q.ids)).toEqual(ids);
    for (const q of queries) {
      expect(q.ids.length).toBeLessThanOrEqual(200);
      expect(q.order).toHaveBeenCalledWith("id");
      expect(q.range).toHaveBeenCalledWith(0, 999);
    }
    expect(from.mock.calls.every(([table]) => table === "costeo_tarifas_vigentes_v")).toBe(true);
  });
  it("pagina incluso cada lote y no duplica filas", async () => {
    const queries = consulta(-1, true);
    expect((await fetchTarifasVigentesPorIds(["a"])).map((r) => r.id)).toEqual(["a"]);
    expect(queries).toHaveLength(2);
    expect(queries[1].ids).toEqual(["a"]);
    expect(queries[1].range).toHaveBeenCalledWith(1000, 1999);
  });
  it("falla sin devolver parcial si un lote posterior falla", async () => {
    consulta(1);
    await expect(fetchTarifasVigentesPorIds(Array.from({ length: 201 }, (_, i) => String(i)))).rejects.toEqual({ message: "falló lote" });
  });
  it("propaga error de página 2 del mismo lote", async () => {
    consulta(1, true);
    await expect(fetchTarifasVigentesPorIds(["a"])).rejects.toEqual({ message: "falló lote" });
  });
  it("no consulta para lista vacía ni para 50 mil IDs", async () => {
    expect(await fetchTarifasVigentesPorIds([])).toEqual([]);
    await expect(fetchTarifasVigentesPorIds(Array.from({ length: 50000 }, (_, i) => String(i)))).rejects.toMatchObject({ code: "LC_RESULTADO_TRUNCADO", limite: 50000 });
    expect(from).not.toHaveBeenCalled();
  });
});
