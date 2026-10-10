import { beforeEach, describe, expect, it, vi } from "vitest";
const { from } = vi.hoisted(() => ({ from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from } }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyWarning: vi.fn() }));
import { listarTarifasTarifario, type FiltroVigencia, type TarifaTarifario } from "../tarifarioService";

const tarifa = (id: string): TarifaTarifario => ({
  id, flete_base: 100, moneda: "USD", dias_libres_demoras: null,
  vigente_desde: "2026-10-01", vigente_hasta: "2026-10-31", notas: null,
  solicitud_pricing_id: null, agente: null, naviera: null, tipo: null, ruta: null,
});
function consulta(rows: TarifaTarifario[], falloDesde?: number) {
  const queries: ReturnType<typeof builder>[] = [];
  function builder() {
    const q = {
      select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(), or: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(), lt: vi.fn().mockReturnThis(),
      range: vi.fn((desde: number, hasta: number) => Promise.resolve({
        data: desde === falloDesde ? null : rows.slice(desde, hasta + 1),
        error: desde === falloDesde ? { message: "falló página 2" } : null,
      })),
    };
    return q;
  }
  from.mockImplementation(() => { const q = builder(); queries.push(q); return q; });
  return queries;
}
beforeEach(() => from.mockReset());

describe("tarifario completo por páginas", () => {
  it("devuelve la tarifa 1001 y mantiene joins, filtros y orden único en cada página", async () => {
    const rows = Array.from({ length: 1001 }, (_, i) => tarifa(String(i)));
    const queries = consulta(rows);
    expect(await listarTarifasTarifario("vigentes", "2026-10-09")).toEqual(rows);
    expect(queries).toHaveLength(2);
    queries.forEach((q, i) => {
      expect(from).toHaveBeenNthCalledWith(i + 1, "costeo_tarifas");
      expect(q.select).toHaveBeenCalledWith(expect.stringContaining("name, country"));
      expect(q.eq).toHaveBeenCalledWith("estado", "vigente");
      expect(q.order.mock.calls).toEqual([["vigente_hasta", { ascending: false }], ["id"]]);
      expect(q.or.mock.calls).toEqual([
        ["vigente_desde.is.null,vigente_desde.lte.2026-10-09"],
        ["vigente_hasta.is.null,vigente_hasta.gte.2026-10-09"],
      ]);
      expect(q.range).toHaveBeenCalledWith(i * 1000, i * 1000 + 999);
    });
  });
  it.each<FiltroVigencia>(["proximas", "vencidas", "todas"])("reaplica %s en todas las páginas", async (filtro) => {
    const queries = consulta(Array.from({ length: 1001 }, (_, i) => tarifa(String(i))));
    await listarTarifasTarifario(filtro, "2026-10-20");
    for (const q of queries) {
      expect(q.or).not.toHaveBeenCalled();
      expect(q.gt.mock.calls).toEqual(filtro === "proximas" ? [["vigente_desde", "2026-10-20"]] : []);
      expect(q.lt.mock.calls).toEqual(filtro === "vencidas" ? [["vigente_hasta", "2026-10-20"]] : []);
    }
  });
  it("no devuelve primera página si falla la segunda", async () => {
    consulta(Array.from({ length: 1001 }, (_, i) => tarifa(String(i))), 1000);
    await expect(listarTarifasTarifario("todas", "2026-10-09")).rejects.toEqual({ message: "falló página 2" });
  });
  it("aplica duración >1 día después de leer todas las páginas", async () => {
    const corta = { ...tarifa("corta"), solicitud_pricing_id: "s", vigente_hasta: "2026-10-02" };
    consulta([...Array.from({ length: 1000 }, () => corta), tarifa("última")]);
    expect((await listarTarifasTarifario("todas", "2026-10-09")).map((t) => t.id)).toEqual(["última"]);
  });
  it("rechaza explícitamente 50 mil filas sin devolver un parcial", async () => {
    const queries = consulta(Array.from({ length: 50000 }, (_, i) => tarifa(String(i))));
    await expect(listarTarifasTarifario("todas", "2026-10-09")).rejects.toMatchObject({ code: "LC_RESULTADO_TRUNCADO", limite: 50000 });
    expect(queries).toHaveLength(50);
  });
});
