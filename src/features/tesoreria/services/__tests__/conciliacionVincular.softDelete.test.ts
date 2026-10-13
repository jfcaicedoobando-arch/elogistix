import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSoftDeleteReadMock } = await import("@/services/__tests__/_softDeleteReadMock");
  return createSoftDeleteReadMock();
});
const { bitacora } = vi.hoisted(() => ({ bitacora: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("../conciliacionBitacora", () => ({ bitacoraConciliarMovimiento: bitacora }));
vi.mock("@/lib/observability/reportCaughtError", () => ({ reportCaughtError: vi.fn() }));
import { conciliarConPago } from "../conciliacionVincular";

type Tipo = "cxc" | "cxp";
const mov = (tipo: Tipo) => tipo === "cxc" ? { cargo: 0, abono: 100 } : { cargo: 100, abono: 0 };
const pago = { monto: 100, moneda: "MXN", es_ajuste: false };
const tabla = (tipo: Tipo) => tipo === "cxc" ? "pagos_factura" : "pagos_proveedor";
const deleted_at = "2026-10-01T00:00:00Z";
const sinEscrituras = () => {
  expect(mock.tableCalls.some(call => call.ops.includes("update"))).toBe(false);
  expect(mock.rpcCalls).toEqual([]); expect(bitacora).not.toHaveBeenCalled();
};
const inicio = (tipo: Tipo) => {
  if (tipo === "cxp") mock.queue("pagos_proveedor", { es_ajuste: false });
  mock.queue("bbva_movimientos", []); // Pago no ocupado por otro movimiento.
};
beforeEach(() => { mock.reset(); bitacora.mockReset(); });

describe.each<Tipo>(["cxc", "cxp"])("conciliación %s sin registros de papelera", tipo => {
  it("conserva flujo vivo, importes, bloqueo optimista y bitácora", async () => {
    inicio(tipo);
    mock.queue("bbva_movimientos", mov(tipo)); // Sentido.
    mock.queue("bbva_movimientos", mov(tipo)); // Importe: consulta propia.
    mock.queue(tabla(tipo), pago);
    mock.queue("bbva_movimientos", [{ id: "mov1" }]); // UPDATE confirmado.
    await conciliarConPago("mov1", tipo, "pago1", "user-test");
    const readMov = mock.tableCalls.filter(call => call.table === "bbva_movimientos" && call.opArgs.some(args => args[0] === "cargo, abono"));
    expect(readMov).toHaveLength(2);
    for (const call of readMov) {
      expect(call.opArgs).toContainEqual(["deleted_at", null]); expect(call.opArgs).toContainEqual(["id", "mov1"]);
    }
    const readPago = mock.tableCalls.find(call => call.table === tabla(tipo) && call.opArgs.some(args => args[0] === "monto, moneda"))!;
    expect(readPago.opArgs).toContainEqual(["deleted_at", null]); expect(readPago.opArgs).toContainEqual(["id", "pago1"]);
    const write = mock.tableCalls.find(call => call.ops.includes("update"))!;
    expect(write.opArgs).toContainEqual(["estado_conciliacion", "Pendiente"]);
    expect(write.opArgs).toContainEqual(["deleted_at", null]);
    expect(mock.getMutationPayload("bbva_movimientos", "update")).toMatchObject({
      pago_factura_id: tipo === "cxc" ? "pago1" : null,
      pago_proveedor_id: tipo === "cxp" ? "pago1" : null, estado_conciliacion: "Conciliado",
    });
    expect(bitacora).toHaveBeenCalledExactlyOnceWith("mov1", tipo, "pago1");
  });
  it.each(["ausente", "borrado"])("movimiento %s en sentido rechaza antes de validar importes o escribir", async estado => {
    inicio(tipo); mock.queue("bbva_movimientos", estado === "ausente" ? null : { ...mov(tipo), deleted_at });
    await expect(conciliarConPago("mov1", tipo, "pago1", "user-test")).rejects.toThrow(/LC_CONFLICTO_CONCURRENCIA/);
    sinEscrituras();
    expect(mock.tableCalls.at(-1)!.opArgs).toContainEqual(["deleted_at", null]);
  });
  it.each(["ausente", "borrado"])("movimiento %s entre las dos lecturas no omite validación de monto", async estado => {
    inicio(tipo); mock.queue("bbva_movimientos", mov(tipo));
    mock.queue("bbva_movimientos", estado === "ausente" ? null : { ...mov(tipo), deleted_at });
    mock.queue(tabla(tipo), pago);
    await expect(conciliarConPago("mov1", tipo, "pago1", "user-test")).rejects.toThrow(/LC_CONFLICTO_CONCURRENCIA/);
    sinEscrituras();
  });
  it.each(["ausente", "borrado"])("pago %s en lectura de monto no alcanza UPDATE", async estado => {
    inicio(tipo); mock.queue("bbva_movimientos", mov(tipo)); mock.queue("bbva_movimientos", mov(tipo));
    mock.queue(tabla(tipo), estado === "ausente" ? null : { ...pago, deleted_at });
    await expect(conciliarConPago("mov1", tipo, "pago1", "user-test")).rejects.toMatchObject({ code: "LC_MOVIMIENTO_PAGO_INEXISTENTE" });
    sinEscrituras(); expect(mock.tableCalls.at(-1)!.opArgs).toContainEqual(["deleted_at", null]);
  });
  it("error en lectura de sentido no omite validación", async () => {
    inicio(tipo); const error = new Error("lectura-sentido"); mock.queue("bbva_movimientos", null, error);
    await expect(conciliarConPago("mov1", tipo, "pago1", "user-test")).rejects.toBe(error); sinEscrituras();
  });
  it.each(["movimiento", "pago"])("error de lectura de monto de %s se propaga sin UPDATE", async destino => {
    inicio(tipo); mock.queue("bbva_movimientos", mov(tipo)); const error = new Error("lectura-monto");
    mock.queue("bbva_movimientos", mov(tipo), destino === "movimiento" ? error : null);
    mock.queue(tabla(tipo), pago, destino === "pago" ? error : null);
    await expect(conciliarConPago("mov1", tipo, "pago1", "user-test")).rejects.toBe(error); sinEscrituras();
  });
  it("conserva rechazo de importes diferentes en filas vivas", async () => {
    inicio(tipo); mock.queue("bbva_movimientos", mov(tipo)); mock.queue("bbva_movimientos", mov(tipo));
    mock.queue(tabla(tipo), { ...pago, monto: 200 });
    await expect(conciliarConPago("mov1", tipo, "pago1", "user-test")).rejects.toMatchObject({ code: "LC_MOVIMIENTO_MONTO_MISMATCH" });
    sinEscrituras();
  });
});
