import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
const { bitacora } = vi.hoisted(() => ({ bitacora: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("../conciliacionBitacora", () => ({ bitacoraConciliarMovimiento: bitacora }));
import { conciliarConPago } from "../conciliacionVincular";
import { mapConciliacionError } from "../conciliacionErrors";
import { sugerirCandidatosDetalle } from "../sugerirCandidatos";
import { sugerirMovsParaPagoProveedor } from "@/features/cxp/services";
import type { MovimientoBBVA } from "../conciliacion";

const ajuste = { id: "ajuste", es_ajuste: true, monto: 1, moneda: "MXN", fecha_pago: "2026-10-07", referencia: "texto libre", cuenta_bancaria_id: null };
// SAFE-CAST: el sugeridor sólo consume importe, cuenta, fecha y estado del fixture.
const mov = { id: "mov", cargo: 1, abono: 0, fecha: "2026-10-07", cuenta_bancaria_id: "cuenta", estado_conciliacion: "Pendiente" } as MovimientoBBVA;
beforeEach(() => { mock.resetResults(); mock.tableCalls.length = 0; bitacora.mockClear(); });
const writes = () => mock.tableCalls.filter(c => c.ops.includes("update"));

describe("ajuste no monetario: servicio de vínculo", () => {
  it("rechaza el flag persistido antes de consultar o modificar banco", async () => {
    mock.setTableResult("pagos_proveedor", { data: ajuste, error: null });
    await expect(conciliarConPago("mov", "cxp", "ajuste", "u")).rejects.toMatchObject({ code: "LC_MOVIMIENTO_AJUSTE_NO_MONETARIO" });
    expect(mock.tableCalls.some(c => c.table === "bbva_movimientos")).toBe(false);
    expect(writes()).toEqual([]); expect(bitacora).not.toHaveBeenCalled();
  });
  it.each([
    { data: null, error: null },
    { data: null, error: { message: "RLS/red" } },
    { data: { id: "p" }, error: null },
  ])("falla cerrado si la clasificación no se puede verificar: %j", async result => {
    mock.setTableResult("pagos_proveedor", result);
    await expect(conciliarConPago("mov", "cxp", "p", "u")).rejects.toMatchObject({ code: "LC_MOVIMIENTO_PAGO_NO_VERIFICABLE" });
    expect(writes()).toEqual([]); expect(bitacora).not.toHaveBeenCalled();
  });
  it("pago normal con referencia Ajuste conserva el flujo y la bitácora", async () => {
    mock.setTableResult("pagos_proveedor", { data: { ...ajuste, es_ajuste: false, referencia: "Ajuste" }, error: null });
    mock.setTableResultOnce("bbva_movimientos", { data: [], error: null });
    mock.setTableResultOnce("bbva_movimientos", { data: mov, error: null });
    mock.setTableResultOnce("bbva_movimientos", { data: mov, error: null });
    mock.setTableResultOnce("bbva_movimientos", { data: [{ id: "mov" }], error: null });
    await conciliarConPago("mov", "cxp", "p", "u");
    expect(writes()).toHaveLength(1); expect(bitacora).toHaveBeenCalledWith("mov", "cxp", "p");
  });
  it("traduce rechazo del trigger después de una lectura previa ordinaria", () => {
    expect(() => mapConciliacionError({ code: "23514", message: "LC_MOVIMIENTO_AJUSTE_NO_MONETARIO: un ajuste no mueve dinero" }))
      .toThrow(expect.objectContaining({ code: "LC_MOVIMIENTO_AJUSTE_NO_MONETARIO" }));
  });
});

describe("ajustes fuera de los sugeridores en ambos sentidos", () => {
  it("pago→banco consulta la clasificación persistida y no consulta movimientos", async () => {
    mock.setTableResult("pagos_proveedor", { data: ajuste, error: null });
    mock.setTableResult("bbva_movimientos", { data: [mov], error: null });
    const stale = { ...ajuste, es_ajuste: false };
    expect(await sugerirMovsParaPagoProveedor(stale)).toEqual([]);
    expect(mock.tableCalls.some(c => c.table === "bbva_movimientos")).toBe(false);
  });
  it("pago→banco falla cerrado si no puede leer el pago", async () => {
    mock.setTableResult("pagos_proveedor", { data: null, error: { message: "RLS/red" } });
    await expect(sugerirMovsParaPagoProveedor(ajuste)).rejects.toMatchObject({ code: "LC_MOVIMIENTO_PAGO_NO_VERIFICABLE" });
    expect(mock.tableCalls.some(c => c.table === "bbva_movimientos")).toBe(false);
  });
  it("pago→banco conserva el control ordinario, sin clasificar por texto", async () => {
    mock.setTableResult("pagos_proveedor", { data: { ...ajuste, es_ajuste: false, referencia: "Ajuste" }, error: null });
    mock.setTableResult("bbva_movimientos", { data: [mov], error: null });
    expect(await sugerirMovsParaPagoProveedor(ajuste)).toHaveLength(1);
  });
  it("banco→pago excluye ajustes antes de contar candidatos o match único", async () => {
    mock.setTableResult("pagos_proveedor", { data: [ajuste], error: null });
    const result = await sugerirCandidatosDetalle(mov, "MXN");
    expect(result).toEqual({ candidatos: [], truncado: false });
    const call = mock.tableCalls.find(c => c.table === "pagos_proveedor")!;
    expect(call.opArgs).toContainEqual(["es_ajuste", false]);
    expect(String(call.opArgs[0])).toContain("es_ajuste");
  });
  it("banco→pago no asume monetario cuando falta el flag", async () => {
    mock.setTableResult("pagos_proveedor", { data: [{ ...ajuste, es_ajuste: null }], error: null });
    expect(await sugerirCandidatosDetalle(mov, "MXN")).toEqual({ candidatos: [], truncado: false });
    expect(mock.tableCalls.some(c => c.table === "bbva_movimientos")).toBe(false);
  });
  it("no consume cupo ni genera ambigüedad con un pago monetario exacto", async () => {
    mock.setTableResult("pagos_proveedor", { data: [ajuste, { ...ajuste, id: "normal", es_ajuste: false, referencia: "Ajuste" }], error: null });
    const result = await sugerirCandidatosDetalle(mov, "MXN");
    expect(result.truncado).toBe(false);
    expect(result.candidatos.map(p => p.pago_id)).toEqual(["normal"]);
  });
});
