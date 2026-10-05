import { beforeEach, describe, expect, it, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
import { fetchPagoDetalle } from "../pagoDetalle";
import { fetchLibroPagos } from "../libroPagos";
import { saldoAplicacion } from "../../domain/pagoDetalle";
beforeEach(() => { mock.resetResults(); mock.rpcCalls.length = 0; });
describe("detalle y libro preservan datos de NC/devolución", () => {
  it("conserva NC convertida sin confundirla con pago recibido", async () => {
    mock.setRpcResult("pago_detalle", { data: { tipo: "pago", pago: { id: "p", monto: 10, moneda: "MXN" },
      aplicaciones: [{ documento_id: "fp11", documento_tipo: "proveedor", moneda: "USD", monto_aplicado: 0.5,
        total: 1, pagado: 0.5, notas_credito_aplicadas: 0.5 }] }, error: null });
    const result = await fetchPagoDetalle({ tipo: "pago", id: "p" });
    expect(result.pago.monto).toBe(10);
    expect(result.aplicaciones[0].notas_credito_aplicadas).toBe(0.5);
    expect(saldoAplicacion(result.aplicaciones[0])).toBe(0);
  });
  it("devuelve tipo, fecha y moneda de devolución sin reclasificar como egreso", async () => {
    const retorno = { id: "a", tipo: "devolucion_anticipo", fecha: "2026-10-03", moneda: "USD", monto: 0.03, tipo_cambio: 20, monto_mxn: 0.6 };
    mock.setRpcResult("pago_detalle", { data: { tipo: "devolucion_anticipo", pago: retorno, aplicaciones: [] }, error: null });
    mock.setRpcResult("libro_pagos", { data: { desde: "2026-10-03", hasta: "2026-10-03", pagos: [retorno] }, error: null });
    expect((await fetchPagoDetalle({ tipo: "devolucion_anticipo", id: "a" })).pago).toMatchObject(retorno);
    expect((await fetchLibroPagos("2026-10-03", "2026-10-03", "org")).pagos[0]).toMatchObject(retorno);
    expect(mock.rpcCalls).toContainEqual({ fn: "pago_detalle", args: { p_tipo: "devolucion_anticipo", p_id: "a" } });
  });
});
