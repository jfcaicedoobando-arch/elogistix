import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { fetchComisionesDevengadas } from "../devengadas";

const base = {
  id: "c1", estado: "Devengada", created_at: "2026-10-03T12:00:00Z", embarque_id: null,
  vendedora_id: null, monto_cobrado_mxn: 0, utilidad_prorrateada_mxn: 0, porcentaje_aplicado: 0,
  comision_mxn: 0, nota: "Sin embarque asociado: pendiente de recálculo (ver cola)",
  facturas: { numero: "A1", moneda: "MXN", cliente_nombre: "Aceros", expediente: null },
  pago: { monto: 116, moneda: "MXN", monto_aplicado_factura: 116, deleted_at: null, estado_rep: "NoAplica" },
};

describe("47 · lectura de comisiones manuales", () => {
  beforeEach(() => { mock.resetResults(); mock.tableCalls.length = 0; });
  it("enriquece los tres cobros reales sin generar comisión ni modificar datos", async () => {
    mock.setTableResult("comisiones_devengadas", {
      data: [116, 0.06, 0.07].map((monto) => ({ ...base, pago: { ...base.pago, monto } })), error: null,
    });
    const rows = await fetchComisionesDevengadas();
    expect(rows.map((r) => r.monto_cobrado_mxn)).toEqual([116, 0.06, 0.07]);
    expect(rows.every((r) => r.comision_mxn === 0 && r.nota === "Sin embarque asociado: comisión no calculada")).toBe(true);
    expect(mock.tableCalls.flatMap((c) => c.ops)).not.toEqual(expect.arrayContaining(["update", "insert", "upsert"]));
    const query = mock.tableCalls[0];
    expect(query.opArgs[query.ops.indexOf("select")][0]).toContain("pago:pago_factura_id");
  });
  it("marca como desconocido el equivalente MXN no calculado, en lugar de cero", async () => {
    mock.setTableResult("comisiones_devengadas", { data: [
      { ...base, pago: null },
      { ...base, pago: { ...base.pago, moneda: "USD" }, facturas: { ...base.facturas, moneda: "USD" } },
    ], error: null });
    expect((await fetchComisionesDevengadas()).map((r) => r.monto_cobrado_mxn)).toEqual([null, null]);
  });
  it("conserva importes y notas de comisiones calculadas y liquidadas históricas", async () => {
    mock.setTableResult("comisiones_devengadas", { data: [
      { ...base, embarque_id: "e1", monto_cobrado_mxn: 100, nota: "Calculada" },
      { ...base, estado: "Liquidada", monto_cobrado_mxn: 90, nota: "Histórico" },
    ], error: null });
    const rows = await fetchComisionesDevengadas();
    expect(rows.map((r) => r.monto_cobrado_mxn)).toEqual([100, 90]);
    expect(rows.map((r) => r.nota)).toEqual(["Calculada", "Histórico"]);
  });
});
