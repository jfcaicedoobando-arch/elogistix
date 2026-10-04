import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { revisarImportacion } from "../revisionImportacion";
const fila = { fecha: "2026-10-03", concepto: "Cobro", referencia: "R", cargo: 0, abono: 25, saldo: 100, hash_dedupe: "banco" };
beforeEach(() => { mock.resetResults(); mock.tableCalls.length = 0; mock.rpcCalls.length = 0; mock.setTableResult("cuentas_bancarias", { data: { id: "cta", alias: "Operativa", banco: "Banorte", moneda: "MXN", activa: true }, error: null }); });
describe("Preflight: sólo lectura completa de la cuenta elegida", () => {
  it("trae la huella y excluye papelera/otras cuentas sin ejecutar RPC", async () => {
    mock.setTableResultOnce("bbva_movimientos", { data: [], error: null });
    mock.setTableResultOnce("bbva_movimientos", { data: [{ id: "e1", cuenta_bancaria_id: "cta", pago_factura_id: "p1", fecha: fila.fecha, cargo: 0, abono: 25, hash_dedupe: "cobro-p1" }], error: null });
    const r = await revisarImportacion("cta", [fila]);
    expect(r.resumen.vinculables).toBe(1);
    expect(mock.rpcCalls).toHaveLength(0);
    expect(mock.tableCalls.every((c) => !c.ops.some((op) => ["insert", "update", "upsert", "delete"].includes(op)))).toBe(true);
    for (const c of mock.tableCalls.filter((c) => c.table === "bbva_movimientos")) {
      expect(c.opArgs).toContainEqual(["cuenta_bancaria_id", "cta"]);
      expect(c.opArgs).toContainEqual(["deleted_at", null]);
    }
  });
  it("pagina candidatos y divide hashes por 500 sin truncar silenciosamente", async () => {
    const filas = Array.from({ length: 501 }, (_, i) => ({ ...fila, hash_dedupe: `b${i}` }));
    mock.setTableResultOnce("bbva_movimientos", { data: [], error: null });
    mock.setTableResultOnce("bbva_movimientos", { data: [], error: null });
    mock.setTableResultOnce("bbva_movimientos", { data: Array.from({ length: 500 }, (_, i) => ({ id: `e${i}`, cuenta_bancaria_id: "cta", pago_factura_id: `p${i}`, fecha: fila.fecha, cargo: 0, abono: 25, hash_dedupe: `cobro-p${i}` })), error: null });
    mock.setTableResultOnce("bbva_movimientos", { data: [], error: null });
    const r = await revisarImportacion("cta", filas);
    expect(r.resumen.ambiguas).toBe(501);
    const rangos = mock.tableCalls.filter((c) => c.ops.includes("range"));
    expect(rangos.map((c) => c.opArgs[c.ops.indexOf("range")])).toEqual([[0, 499], [500, 999]]);
  });
  it("una cuenta inactiva o lectura fallida bloquea el resumen", async () => {
    mock.setTableResult("cuentas_bancarias", { data: { activa: false }, error: null });
    await expect(revisarImportacion("cta", [fila])).rejects.toThrow("inactiva");
    expect(mock.tableCalls).toHaveLength(1);
    mock.setTableResult("cuentas_bancarias", { data: null, error: { message: "sin acceso" } });
    await expect(revisarImportacion("cta", [fila])).rejects.toMatchObject({ message: "sin acceso" });
  });
});
