/**
 * MNY (item 9): el historial de liquidaciones se lee por páginas; con más de
 * 500 filas ya no se ocultan las antiguas.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchLiquidaciones } from "../liquidaciones";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.resetResults();
});

function pagina(n: number, desde: number) {
  return Array.from({ length: n }, (_, i) => ({ id: `l${desde + i}` }));
}

describe("fetchLiquidaciones", () => {
  it("lee todas las páginas hasta un lote incompleto", async () => {
    mock.setTableResultOnce("liquidaciones_comision", { data: pagina(1000, 0), error: null });
    mock.setTableResultOnce("liquidaciones_comision", { data: pagina(120, 1000), error: null });
    const rows = await fetchLiquidaciones();
    expect(rows.length).toBe(1120);
    const calls = mock.tableCalls.filter((c) => c.table === "liquidaciones_comision");
    expect(calls.length).toBe(2);
    expect(calls[0].ops).toContain("range");
  });

  it("propaga el error de lectura en vez de devolver una lista parcial", async () => {
    mock.setTableResultOnce("liquidaciones_comision", { data: null, error: { message: "boom" } });
    await expect(fetchLiquidaciones()).rejects.toThrow(/boom/);
  });
});
