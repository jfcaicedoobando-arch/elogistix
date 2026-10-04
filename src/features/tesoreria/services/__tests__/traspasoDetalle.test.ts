import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { fetchTraspasoDetalle } from "../traspasoDetalle";
beforeEach(() => { mock.resetResults(); mock.tableCalls.length = 0; mock.rpcCalls.length = 0; });
describe("Detalle financiero propio del traspaso", () => {
  it("lee el traspaso y sus patas por ID, sin RPC de factura ni mutaciones", async () => {
    mock.setTableResult("traspasos_bancarios", { data: { id: "t1", origen: { id: "origen" }, destino: { id: "destino" } }, error: null });
    mock.setTableResult("bbva_movimientos", { data: [{ id: "salida" }, { id: "entrada" }, { id: "comision" }], error: null });
    const r = await fetchTraspasoDetalle("t1");
    expect(r.movimientos.map((m) => m.id)).toEqual(["salida", "entrada", "comision"]);
    expect(mock.rpcCalls).toHaveLength(0);
    expect(mock.tableCalls.map((c) => c.table)).toEqual(["traspasos_bancarios", "bbva_movimientos"]);
    expect(mock.tableCalls[1].opArgs).toContainEqual(["traspaso_id", "t1"]);
    for (const c of mock.tableCalls) {
      expect(c.opArgs).toContainEqual(["deleted_at", null]);
      expect(c.ops.some((op) => ["insert", "update", "delete", "upsert"].includes(op))).toBe(false);
    }
  });
  it("un traspaso sin acceso no se degrada a detalle de pago", async () => {
    mock.setTableResult("traspasos_bancarios", { data: null, error: { message: "sin acceso" } });
    await expect(fetchTraspasoDetalle("t1")).rejects.toMatchObject({ message: "sin acceso" });
    expect(mock.tableCalls).toHaveLength(1); expect(mock.rpcCalls).toHaveLength(0);
  });
});
