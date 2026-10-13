import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSoftDeleteReadMock } = await import("@/services/__tests__/_softDeleteReadMock");
  return createSoftDeleteReadMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { MSG_TRASPASO_LLAVE_REUSADA, registrarTraspaso } from "../traspasos";

const input = { cuentaOrigenId: "origen-test", cuentaDestinoId: "destino-test", fecha: "2026-10-01",
  montoOrigen: 100, tipoCambio: 1, clientRequestId: "llave-test" };
const guardado = { id: "tr-test", cuenta_origen_id: input.cuentaOrigenId, cuenta_destino_id: input.cuentaDestinoId,
  fecha: input.fecha, monto_origen: input.montoOrigen, tipo_cambio: input.tipoCambio, comision: 0 };
const uniqueError = { code: "23505", message: "client_request_id ya existe" };
beforeEach(() => {
  mock.reset(); mock.setRpcResult("registrar_traspaso_bancario", { data: null, error: uniqueError });
});

describe("idempotencia de traspasos: no reutilizar papelera", () => {
  it("registro nuevo conserva la llave y devuelve duplicado false", async () => {
    mock.setRpcResult("registrar_traspaso_bancario", { data: "nuevo-test", error: null });
    expect(await registrarTraspaso(input)).toEqual({ id: "nuevo-test", duplicado: false });
    expect(mock.tableCalls).toEqual([]);
    expect(mock.rpcCalls).toEqual([{ fn: "registrar_traspaso_bancario", args: expect.objectContaining({ p_client_request_id: input.clientRequestId }) }]);
  });
  it("retry de fila viva con igual contenido devuelve duplicado true", async () => {
    mock.queue("traspasos_bancarios", guardado);
    expect(await registrarTraspaso(input)).toEqual({ id: guardado.id, duplicado: true });
    expect(mock.tableCalls[0].opArgs).toContainEqual(["client_request_id", input.clientRequestId]);
    expect(mock.tableCalls[0].opArgs).toContainEqual(["deleted_at", null]);
    expect(mock.rpcCalls).toHaveLength(1);
  });
  it.each([null, { ...guardado, deleted_at: "2026-10-01T00:00:00Z" }])("ausente/borrado propaga UNIQUE sin recrear ni recuperar llave: %j", async row => {
    mock.queue("traspasos_bancarios", row);
    await expect(registrarTraspaso(input)).rejects.toBe(uniqueError);
    expect(mock.rpcCalls).toHaveLength(1);
    expect(mock.tableCalls).toHaveLength(1);
    expect(mock.tableCalls[0].ops).not.toContain("insert");
    expect(mock.tableCalls[0].ops).not.toContain("update");
    expect(mock.tableCalls[0].opArgs).toContainEqual(["deleted_at", null]);
  });
  it("reintentos sucesivos de fila borrada siguen fallando con la misma llave", async () => {
    for (let i = 0; i < 2; i++) {
      mock.queue("traspasos_bancarios", { ...guardado, deleted_at: "2026-10-01T00:00:00Z" });
      await expect(registrarTraspaso(input)).rejects.toBe(uniqueError);
    }
    expect(mock.rpcCalls).toHaveLength(2);
    for (const call of mock.rpcCalls) expect(call.args).toMatchObject({ p_client_request_id: input.clientRequestId });
    expect(mock.tableCalls.every(c => c.ops.every(op => op !== "insert" && op !== "update"))).toBe(true);
  });
  it("fila viva con contenido distinto conserva el conflicto", async () => {
    mock.queue("traspasos_bancarios", { ...guardado, monto_origen: 200 });
    await expect(registrarTraspaso(input)).rejects.toThrow(MSG_TRASPASO_LLAVE_REUSADA);
    expect(mock.rpcCalls).toHaveLength(1);
  });
  it("UNIQUE sin clave no intenta deduplicar", async () => {
    await expect(registrarTraspaso({ ...input, clientRequestId: null })).rejects.toBe(uniqueError);
    expect(mock.tableCalls).toEqual([]); expect(mock.rpcCalls).toHaveLength(1);
  });
});
