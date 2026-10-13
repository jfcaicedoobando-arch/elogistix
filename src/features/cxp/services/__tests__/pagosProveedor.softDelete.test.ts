import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSoftDeleteReadMock } = await import("@/services/__tests__/_softDeleteReadPlanMock");
  return createSoftDeleteReadMock();
});
const { actividad } = vi.hoisted(() => ({ actividad: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/services/bitacora/registrar", () => ({ registrarActividad: actividad }));
import { actualizarPagoProveedor } from "../pagoProveedorActualizar";
import { registrarPagoProveedor, MSG_PAGO_LLAVE_REUSADA } from "../pagosProveedor";
const input = { proveedor_factura_id: "fact1", fecha_pago: "2026-10-01", monto: 100, moneda: "MXN" as const, tipo_cambio_usd: null, metodo_pago: "Transferencia", client_request_id: "llave-test" };
const pago = { id: "pago1", organization_id: "org-test", ...input, cuenta_bancaria_id: null, deleted_at: null, es_anticipo_aplicado: false, anticipos_aplicaciones: [] };
const editar = { ...input, id: "pago1", expectedUpdatedAt: "2026-10-01T00:00:00Z" };
beforeEach(() => { mock.reset(); actividad.mockReset(); });
const prepararRegistro = (row: unknown, error: unknown = null) => {
  mock.queue("proveedor_facturas", { organization_id: "org-test", estado_aprobacion: "aprobada" });
  mock.setRpcResult("current_user_org_id", { data: "org-test", error: null });
  mock.setRpcResult("registrar_pago_proveedor_atomico", { data: { pago_id: "pago1", movimiento_id: "mov-test" }, error: null });
  mock.queue("pagos_proveedor", row, error);
};
describe("edición de pago: filtro propio conserva rechazos previos", () => {
  it.each([null, { ...pago, deleted_at: "2026-10-01" }])("rechaza ausente/borrado antes de RPC o actividad: %j", async row => {
    mock.queue("pagos_proveedor", row);
    await expect(actualizarPagoProveedor(editar, "actor")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(mock.tableCalls[0].opArgs).toContainEqual(["deleted_at", null]); expect(mock.rpcCalls).toHaveLength(0); expect(actividad).not.toHaveBeenCalled();
  });
  it.each([{ es_anticipo_aplicado: true }, { anticipos_aplicaciones: [{ id: "app-test", deleted_at: null }] }])("mantiene el bloqueo de anticipos: %j", async flag => {
    mock.queue("pagos_proveedor", { ...pago, ...flag });
    await expect(actualizarPagoProveedor(editar, "actor")).rejects.toThrow(/LC_PAGO_ANTICIPO_NO_EDITABLE/);
    expect(mock.rpcCalls).toHaveLength(0); expect(actividad).not.toHaveBeenCalled();
  });
  it("pago vivo con aplicación borrada conserva una RPC atómica y la actividad", async () => {
    mock.queue("pagos_proveedor", { ...pago, anticipos_aplicaciones: [{ id: "app-test", deleted_at: "2026-10-01" }] });
    mock.setRpcResult("actualizar_pago_proveedor_atomico", { data: { movimiento_creado: true }, error: null });
    await actualizarPagoProveedor(editar, "actor"); expect(mock.rpcCalls).toHaveLength(1); expect(actividad).toHaveBeenCalledOnce();
    expect(mock.rpcCalls[0].args).toMatchObject({ p_expected_updated_at: editar.expectedUpdatedAt, p_monto: input.monto });
    expect(mock.tableCalls[0].opArgs).toContainEqual(["deleted_at", null]);
  });
});
describe("recuperación de pago tras RPC: sólo fila viva", () => {
  it.each([null, { ...pago, deleted_at: "2026-10-01" }])("ausente/borrado no retorna éxito ni actividad: %j", async row => {
    prepararRegistro(row); await expect(registrarPagoProveedor(input, "actor")).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(actividad).not.toHaveBeenCalled(); expect(mock.rpcCalls.filter(c => c.fn === "registrar_pago_proveedor_atomico")).toHaveLength(1);
    expect(mock.tableCalls).toHaveLength(2); expect(mock.tableCalls[1].opArgs).toContainEqual(["deleted_at", null]);
  });
  it("dos reintentos vivos conservan id, contenido y llave sin insert directo", async () => {
    for (let i = 0; i < 2; i++) {
      prepararRegistro(pago); expect(await registrarPagoProveedor(input, "actor")).toEqual(pago);
    }
    const calls = mock.rpcCalls.filter(c => c.fn === "registrar_pago_proveedor_atomico"); expect(calls).toHaveLength(2);
    for (const call of calls) expect(call.args).toMatchObject({ p_client_request_id: input.client_request_id, p_monto: input.monto });
    expect(mock.tableCalls.some(c => c.ops.includes("insert") || c.ops.includes("update"))).toBe(false);
    expect(actividad).toHaveBeenCalledTimes(2);
  });
  it("dos reintentos de fila borrada rechazan sin reciclar llave ni recrear pago", async () => {
    for (let i = 0; i < 2; i++) {
      prepararRegistro({ ...pago, deleted_at: "2026-10-01" });
      await expect(registrarPagoProveedor(input, "actor")).rejects.toMatchObject({ code: "NOT_FOUND" });
    }
    const calls = mock.rpcCalls.filter(c => c.fn === "registrar_pago_proveedor_atomico"); expect(calls).toHaveLength(2);
    for (const call of calls) expect(call.args).toMatchObject({ p_client_request_id: input.client_request_id });
    expect(mock.tableCalls.some(c => c.ops.includes("insert") || c.ops.includes("update"))).toBe(false);
    expect(actividad).not.toHaveBeenCalled();
  });
  it("fila viva de contenido distinto conserva el conflicto de llave", async () => {
    prepararRegistro({ ...pago, monto: 999 }); await expect(registrarPagoProveedor(input, "actor")).rejects.toThrow(MSG_PAGO_LLAVE_REUSADA);
    expect(actividad).not.toHaveBeenCalled();
  });
  it("UNIQUE del RPC se propaga sin lookup de pago ni recreación", async () => {
    mock.queue("proveedor_facturas", { organization_id: "org-test", estado_aprobacion: "aprobada" });
    mock.setRpcResult("current_user_org_id", { data: "org-test", error: null });
    const error = { code: "23505", message: "client_request_id ya existe" };
    mock.setRpcResult("registrar_pago_proveedor_atomico", { data: null, error });
    await expect(registrarPagoProveedor(input, "actor")).rejects.toBe(error); expect(mock.tableCalls).toHaveLength(1); expect(actividad).not.toHaveBeenCalled();
  });
  it("error del lookup de pago se propaga antes de actividad", async () => {
    const error = new Error("lectura-pago"); prepararRegistro(null, error);
    await expect(registrarPagoProveedor(input, "actor")).rejects.toBe(error); expect(actividad).not.toHaveBeenCalled();
  });
});
