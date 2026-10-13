import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSoftDeleteReadMock } = await import("@/services/__tests__/_softDeleteReadPlanMock");
  return createSoftDeleteReadMock();
});
const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { ...mock.supabase, functions: { invoke } } }));
import { autoEnviarRepPorCorreo } from "../repAutoEmail";
beforeEach(() => { mock.reset(); invoke.mockReset(); });
describe("REP: corte antes de destinatarios y correo", () => {
  it.each([null, { id: "p1", factura_id: "f1", deleted_at: "2026-10-01" }])("pago ausente/borrado no consulta factura ni contactos: %j", async row => {
    mock.queue("pagos_factura", row); await autoEnviarRepPorCorreo("p1");
    expect(mock.tableCalls).toHaveLength(1); expect(invoke).not.toHaveBeenCalled();
    expect(mock.tableCalls[0].opArgs).toContainEqual(["deleted_at", null]);
  });
  it.each([null, { cliente_id: "cli1", deleted_at: "2026-10-01" }])("factura ausente/borrada no consulta destinatarios: %j", async row => {
    mock.queue("pagos_factura", { id: "p1", factura_id: "f1" }); mock.queue("facturas", row);
    await autoEnviarRepPorCorreo("p1"); expect(mock.tableCalls).toHaveLength(2); expect(invoke).not.toHaveBeenCalled();
    expect(mock.tableCalls[1].opArgs).toContainEqual(["deleted_at", null]);
  });
  it("pago y factura vivos conservan selección de destinatario y llamada simulada", async () => {
    mock.queue("pagos_factura", { id: "p1", factura_id: "f1" }); mock.queue("facturas", { cliente_id: "cli1" });
    mock.queue("contactos_cliente", [{ email: "cliente@example.invalid" }]);
    await autoEnviarRepPorCorreo("p1");
    for (const call of mock.tableCalls) expect(call.opArgs).toContainEqual(["deleted_at", null]);
    expect(mock.tableCalls[0].opArgs).toContainEqual(["id", "p1"]); expect(mock.tableCalls[1].opArgs).toContainEqual(["id", "f1"]);
    expect(mock.tableCalls[2].opArgs).toContainEqual(["cliente_id", "cli1"]);
    expect(invoke).toHaveBeenCalledExactlyOnceWith("facturapi-enviar-email", { body: { pago_id: "p1", email: "cliente@example.invalid" } });
  });
  it.each(["pago", "factura"])("error de %s conserva el corte silencioso", async table => {
    mock.queue("pagos_factura", { id: "p1", factura_id: "f1" }, table === "pago" ? new Error("lectura") : null);
    if (table === "factura") mock.queue("facturas", null, new Error("lectura"));
    await autoEnviarRepPorCorreo("p1"); expect(invoke).not.toHaveBeenCalled();
    expect(mock.tableCalls.some(c => c.table === "contactos_cliente")).toBe(false);
  });
});
