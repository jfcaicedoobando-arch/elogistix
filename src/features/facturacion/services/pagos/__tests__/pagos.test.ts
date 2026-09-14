import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    ...mock.supabase,
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-1" } } }) },
  },
}));

import { listarPagosFactura, registrarPagoFactura, eliminarPagoFactura, PagoConRepVivoError } from "../index";

const validInput = {
  factura_id: "fac-1",
  fecha_pago: "2025-01-15",
  monto: 1000,
  moneda: "MXN" as const,
  tipo_cambio: 1,
  monto_aplicado_factura: 1000,
  forma_pago: "transferencia",
};

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
  mock.resetResults();
});

describe("listarPagosFactura", () => {
  it("devuelve arreglo de pagos", async () => {
    mock.setTableResult("pagos_factura", { data: [{ id: "p-1" }, { id: "p-2" }], error: null });
    const r = await listarPagosFactura("fac-1");
    expect(r).toHaveLength(2);
  });

  it("devuelve [] cuando data es null", async () => {
    mock.setTableResult("pagos_factura", { data: null, error: null });
    const r = await listarPagosFactura("fac-1");
    expect(r).toEqual([]);
  });

  it("propaga error de supabase al listar pagos", async () => {
    mock.setTableResult("pagos_factura", { data: null, error: { message: "err" } });
    await expect(listarPagosFactura("fac-1")).rejects.toThrow();
  });
});

describe("registrarPagoFactura", () => {
  // D2 (v13.823.382): el cobro se registra con una sola RPC atómica.
  it("happy path: llama la RPC atómica y devuelve el id", async () => {
    mock.setRpcResult("registrar_pago_factura_atomico", {
      data: { pago_id: "pago-1", movimiento_bancario: "no_aplica" },
      error: null,
    });
    await expect(registrarPagoFactura(validInput)).resolves.toMatchObject({ pagoId: "pago-1" });
    expect(mock.rpcCalls[0]?.fn).toBe("registrar_pago_factura_atomico");
    // Ya no hay INSERT directo desde el navegador.
    expect(mock.tableCalls.filter((c) => c.ops.includes("insert"))).toHaveLength(0);
  });

  it("reporta el abono bancario cuando la RPC lo creó", async () => {
    mock.setRpcResult("registrar_pago_factura_atomico", {
      data: { pago_id: "pago-2", movimiento_bancario: "creado" },
      error: null,
    });
    await expect(registrarPagoFactura({ ...validInput, cuenta_bancaria_id: "cta-1" }))
      .resolves.toMatchObject({ pagoId: "pago-2", movimientoBancario: "creado" });
  });

  it("un reintento con el mismo client_request_id devuelve el cobro existente", async () => {
    mock.setRpcResult("registrar_pago_factura_atomico", {
      data: { pago_id: "pago-3", movimiento_bancario: "creado", reintento: true },
      error: null,
    });
    await expect(registrarPagoFactura({ ...validInput, client_request_id: "req-1" }))
      .resolves.toMatchObject({ pagoId: "pago-3" });
    expect(mock.rpcCalls[0]?.args).toMatchObject({ p_client_request_id: "req-1" });
  });

  it("propaga el error de la RPC (el cobro no queda huérfano)", async () => {
    mock.setRpcResult("registrar_pago_factura_atomico", {
      data: null,
      error: { message: "LC_COBRO_MOVIMIENTO_FALLIDO" },
    });
    await expect(registrarPagoFactura(validInput)).rejects.toThrow();
  });
});

describe("eliminarPagoFactura", () => {
  it("Ola 15 · llama la RPC atómica y devuelve el resumen del banco", async () => {
    mock.setTableResult("pagos_factura", { data: { id: "p-1", uuid_rep: null, rep_cancelado_en: null }, error: null });
    mock.setRpcResult("eliminar_pago_cliente", {
      data: { movimientos_baja: 1, movimientos_desvinculados: 0, ya_eliminado: false },
      error: null,
    });
    await expect(eliminarPagoFactura("p-1")).resolves.toEqual({
      movimientosBaja: 1,
      movimientosDesvinculados: 0,
      yaEliminado: false,
    });
    expect(mock.rpcCalls.at(-1)).toEqual({ fn: "eliminar_pago_cliente", args: { _pago_id: "p-1" } });
    // Ya no hay UPDATE directo desde el cliente: todo ocurre en la RPC.
    const updates = mock.tableCalls.filter((c) => c.ops.includes("update"));
    expect(updates).toHaveLength(0);
  });

  it("reporta el movimiento importado que quedó desvinculado", async () => {
    mock.setTableResult("pagos_factura", { data: { id: "p-1", uuid_rep: null, rep_cancelado_en: null }, error: null });
    mock.setRpcResult("eliminar_pago_cliente", {
      data: { movimientos_baja: 0, movimientos_desvinculados: 1, ya_eliminado: false },
      error: null,
    });
    await expect(eliminarPagoFactura("p-1")).resolves.toMatchObject({ movimientosDesvinculados: 1 });
  });

  it("permite eliminar cuando el REP existe pero ya está cancelado", async () => {
    mock.setTableResult("pagos_factura", { data: { id: "p-1", uuid_rep: "uuid-abc", rep_cancelado_en: "2026-01-01" }, error: null });
    mock.setRpcResult("eliminar_pago_cliente", { data: { movimientos_baja: 0 }, error: null });
    await expect(eliminarPagoFactura("p-1")).resolves.toMatchObject({ yaEliminado: false });
  });

  it("R.5 · Bug 8 — bloquea eliminar cuando hay REP vivo (uuid_rep + rep_cancelado_en NULL)", async () => {
    mock.setTableResult("pagos_factura", { data: { id: "p-1", uuid_rep: "uuid-abc", rep_cancelado_en: null }, error: null });
    await expect(eliminarPagoFactura("p-1")).rejects.toBeInstanceOf(PagoConRepVivoError);
    // Verificamos que ni siquiera se intentó la RPC.
    expect(mock.rpcCalls.filter((c) => c.fn === "eliminar_pago_cliente")).toHaveLength(0);
  });

  it("R.5 · Bug 8 — mapea LC_PAGO_CON_REP_VIVO de la RPC a PagoConRepVivoError", async () => {
    mock.setTableResult("pagos_factura", { data: null, error: { message: "sin datos" } });
    mock.setRpcResult("eliminar_pago_cliente", { data: null, error: { message: "LC_PAGO_CON_REP_VIVO: no permitido" } });
    await expect(eliminarPagoFactura("p-1")).rejects.toBeInstanceOf(PagoConRepVivoError);
  });

  it("propaga errores genéricos de supabase al eliminar", async () => {
    mock.setTableResult("pagos_factura", { data: null, error: { message: "rls" } });
    mock.setRpcResult("eliminar_pago_cliente", { data: null, error: { message: "rls" } });
    await expect(eliminarPagoFactura("p-1")).rejects.toThrow();
  });
});

