import { describe, it, expect, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/lib/date/today", () => ({ todayLocalISO: () => "2026-09-24" }));

import { contarTarifasPendientesAprobacion } from "../tarifasPendientes";
import { fetchCosteoTarifas } from "../tarifas";

function ops(i = -1) {
  const c = mock.tableCalls.at(i)!;
  return c.ops.map((op, k) => [op, ...c.opArgs[k]]);
}

describe("P2-A6 · KPI de Operaciones = borradores aprobables", () => {
  it("excluye vencidos (vigente_hasta >= hoy; vence hoy sí cuenta)", async () => {
    mock.setTableResult("costeo_tarifas", { data: null, error: null, count: 2 });
    expect(await contarTarifasPendientesAprobacion("org")).toBe(2);
    expect(ops()).toEqual(expect.arrayContaining([
      ["eq", "estado_aprobacion", "borrador"],
      ["gte", "vigente_hasta", "2026-09-24"],
    ]));
  });
});

describe("P2-A1 · filtro 'Vigentes hoy' en servidor", () => {
  it("exige aprobada y desde <= hoy <= hasta (excluye futuras y pendientes)", async () => {
    mock.setTableResult("costeo_tarifas", { data: [], error: null });
    await fetchCosteoTarifas("org", { estado: "vigente" });
    expect(ops()).toEqual(expect.arrayContaining([
      ["eq", "estado", "vigente"],
      ["eq", "estado_aprobacion", "vigente"],
      ["lte", "vigente_desde", "2026-09-24"],
      ["gte", "vigente_hasta", "2026-09-24"],
    ]));
  });
  it("'Todas' no filtra por vigencia (programadas siguen visibles)", async () => {
    mock.setTableResult("costeo_tarifas", { data: [], error: null });
    await fetchCosteoTarifas("org", { estado: "todas" });
    expect(ops().map((o) => o[0])).not.toContain("lte");
  });
  it("'Vencidas' conserva el filtro técnico", async () => {
    mock.setTableResult("costeo_tarifas", { data: [], error: null });
    await fetchCosteoTarifas("org", { estado: "vencida" });
    expect(ops()).toEqual(expect.arrayContaining([["eq", "estado", "vencida"]]));
  });
});
