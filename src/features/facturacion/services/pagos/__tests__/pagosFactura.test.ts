import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  const base = createSupabaseMock();
  const getUser = vi.fn();
  return {
    ...base,
    getUser,
    supabase: { ...base.supabase, auth: { getUser } },
  };
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  listarPagosFactura,
  registrarPagoFactura,
  eliminarPagoFactura,
} from "@/features/facturacion/services/pagos";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
  mock.resetResults();
  mock.getUser.mockReset();
  mock.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

const INPUT = {
  factura_id: "f1",
  fecha_pago: "2026-06-01",
  monto: 1000,
  moneda: "MXN" as const,
  tipo_cambio: 1,
  monto_aplicado_factura: 1000,
  forma_pago: "transferencia",
};

describe("services/pagos-factura", () => {
  it("listarPagosFactura devuelve lista", async () => {
    mock.setTableResult("pagos_factura", { data: [{ id: "p1" }], error: null });
    const r = await listarPagosFactura("f1");
    expect(r).toHaveLength(1);
  });

  it("listarPagosFactura devuelve [] cuando data es null", async () => {
    mock.setTableResult("pagos_factura", { data: null, error: null });
    const r = await listarPagosFactura("f1");
    expect(r).toEqual([]);
  });

  it("listarPagosFactura propaga error", async () => {
    mock.setTableResult("pagos_factura", { data: null, error: { message: "x" } });
    await expect(listarPagosFactura("f1")).rejects.toThrow();
  });

  // D2 (v13.823.382): el alta pasa por la RPC atómica; los defaults se
  // normalizan en los argumentos de la llamada.
  it("registrarPagoFactura manda los importes y defaults a la RPC", async () => {
    mock.setRpcResult("registrar_pago_factura_atomico", { data: { pago_id: "p1" }, error: null });
    await registrarPagoFactura(INPUT as never);
    const args = mock.rpcCalls[0].args as Record<string, unknown>;
    expect(args.p_diferencia_cambiaria_mxn).toBe(0);
    expect(args.p_referencia).toBe("");
    expect(args.p_notas).toBe("");
    expect(args.p_cuenta_bancaria_id).toBeNull();
  });

  it("registrarPagoFactura usa diferencia_cambiaria_mxn dado", async () => {
    mock.setRpcResult("registrar_pago_factura_atomico", { data: { pago_id: "p1" }, error: null });
    await registrarPagoFactura({ ...INPUT, diferencia_cambiaria_mxn: 25 } as never);
    expect((mock.rpcCalls[0].args as Record<string, unknown>).p_diferencia_cambiaria_mxn).toBe(25);
  });

  it("registrarPagoFactura propaga error", async () => {
    mock.setRpcResult("registrar_pago_factura_atomico", { data: null, error: { message: "x" } });
    await expect(registrarPagoFactura(INPUT as never)).rejects.toThrow();
  });

  it("eliminarPagoFactura delega en la RPC atómica", async () => {
    mock.setTableResult("pagos_factura", { data: { id: "p1", uuid_rep: null, rep_cancelado_en: null }, error: null });
    mock.setRpcResult("eliminar_pago_cliente", { data: { movimientos_baja: 1 }, error: null });
    const r = await eliminarPagoFactura("p1");
    expect(r.movimientosBaja).toBe(1);
    expect(mock.rpcCalls.some((c) => c.fn === "eliminar_pago_cliente")).toBe(true);
  });

  it("eliminarPagoFactura propaga error", async () => {
    mock.setTableResult("pagos_factura", { data: null, error: { message: "x" } });
    mock.setRpcResult("eliminar_pago_cliente", { data: null, error: { message: "x" } });
    await expect(eliminarPagoFactura("p1")).rejects.toThrow();
  });
});
