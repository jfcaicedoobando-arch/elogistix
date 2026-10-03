import { beforeEach, describe, expect, it, vi } from "vitest";
const { mock } = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return { mock: createSupabaseMock() };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { consultarEstadoFacturasLote } from "../pagoProveedorLotePreflight";
import { registrarPagoProveedorLote } from "../pagoProveedorLote";

const input = {
  proveedor_id: "p1", fecha_pago: "2026-10-03", moneda: "MXN", metodo_pago: "Efectivo",
  referencia: "fixture-auditoria-19", cuenta_bancaria_id: null, importe_recibido: 25,
  renglones: [{ factura_id: "f1", monto: 12.5 }, { factura_id: "f2", monto: 12.5 }],
};
const estado = (id: string, estado_aprobacion = "aprobada") => ({ id, proveedor_id: "p1", moneda: "MXN", estado_aprobacion });
beforeEach(() => {
  mock.resetResults(); mock.rpcCalls.length = 0; mock.tableCalls.length = 0;
  mock.setRpcResult("current_user_org_id", { data: "org-prueba", error: null });
  mock.setRpcResult("registrar_pago_proveedor_lote", { data: "lote-fixture", error: null });
});
describe("Preflight de pago en lote", () => {
  it("FP por aprobar bloquea antes de llamar a la RPC transaccional", async () => {
    mock.setTableResult("proveedor_facturas", { data: [estado("f1", "pendiente"), estado("f2")], error: null });
    await expect(registrarPagoProveedorLote(input)).rejects.toThrow(/aprobadas/);
    expect(mock.rpcCalls.map((c) => c.fn)).toEqual(["current_user_org_id"]);
    expect(mock.tableCalls[0].opArgs).toContainEqual(["organization_id", "org-prueba"]);
  });
  it("relee el estado en cada intento y conserva los guards del servidor", async () => {
    mock.setTableResult("proveedor_facturas", { data: [estado("f1"), estado("f2")], error: null });
    await expect(registrarPagoProveedorLote(input)).resolves.toBe("lote-fixture");
    mock.setTableResult("proveedor_facturas", { data: [estado("f1", "rechazada"), estado("f2")], error: null });
    await expect(registrarPagoProveedorLote(input)).rejects.toThrow(/aprobadas/);
    expect(mock.rpcCalls.filter((c) => c.fn === "registrar_pago_proveedor_lote")).toHaveLength(1);
  });
  it.each([
    { rows: [] }, { rows: [estado("f1")] },
    { rows: [estado("f1"), { ...estado("f2"), proveedor_id: "otro" }] },
    { rows: [estado("f1"), { ...estado("f2"), moneda: "USD" }] },
  ])("bloquea registros inaccesibles o fuera del proveedor/moneda: $rows", async ({ rows }) => {
    mock.setTableResult("proveedor_facturas", { data: rows, error: null });
    await expect(registrarPagoProveedorLote(input)).rejects.toThrow();
    expect(mock.rpcCalls.some((c) => c.fn === "registrar_pago_proveedor_lote")).toBe(false);
  });
  it("propaga fallo de consulta y no muta", async () => {
    mock.setTableResult("proveedor_facturas", { data: null, error: new Error("red-fixture") });
    await expect(registrarPagoProveedorLote(input)).rejects.toThrow("red-fixture");
    await expect(consultarEstadoFacturasLote(["f1"], "")).rejects.toThrow("LC_ORG_REQUERIDA");
    expect(mock.rpcCalls.some((c) => c.fn === "registrar_pago_proveedor_lote")).toBe(false);
  });
});
