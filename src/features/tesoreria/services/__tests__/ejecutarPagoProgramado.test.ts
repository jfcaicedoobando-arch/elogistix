import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { ejecutarPagoProgramado } from "../ejecutarPagoProgramado";

describe("ejecutarPagoProgramado", () => {
  beforeEach(() => {
    mock.rpcCalls.length = 0;
    mock.setRpcResult("ejecutar_pago_programado", { data: null, error: null });
  });

  it("llama a la RPC con los parámetros correctos y regresa el resultado", async () => {
    mock.setRpcResult("ejecutar_pago_programado", {
      data: { pago_id: "p1", movimiento_id: "m1", saldo_cuenta_restante: 500 },
      error: null,
    });

    const res = await ejecutarPagoProgramado({
      facturaId: "f1",
      cuentaBancariaId: "c1",
      fecha: "2024-05-01",
      monto: 100,
      metodoPago: "Transferencia",
      referencia: "REF-1",
    });

    expect(mock.rpcCalls[0]).toEqual({
      fn: "ejecutar_pago_programado",
      args: {
        p_factura_id: "f1",
        p_cuenta_bancaria_id: "c1",
        p_fecha: "2024-05-01",
        p_monto: 100,
        p_metodo_pago: "Transferencia",
        p_referencia: "REF-1",
      },
    });
    expect(res).toEqual({ pago_id: "p1", movimiento_id: "m1", saldo_cuenta_restante: 500 });
  });

  it("usa valores por defecto de método/referencia cuando no se envían", async () => {
    await ejecutarPagoProgramado({
      facturaId: "f1", cuentaBancariaId: "c1", fecha: "2024-05-01", monto: 50,
    });
    expect(mock.rpcCalls[0].args).toMatchObject({ p_metodo_pago: "Transferencia", p_referencia: "" });
  });

  it("propaga el error de saldo insuficiente (LC_CUENTA_SALDO_INSUFICIENTE)", async () => {
    mock.setRpcResult("ejecutar_pago_programado", {
      data: null,
      error: { message: "LC_CUENTA_SALDO_INSUFICIENTE: El saldo de la cuenta (100.00) es insuficiente para pagar 500.00." },
    });

    await expect(
      ejecutarPagoProgramado({ facturaId: "f1", cuentaBancariaId: "c1", fecha: "2024-05-01", monto: 500 }),
    ).rejects.toMatchObject({ message: expect.stringContaining("LC_CUENTA_SALDO_INSUFICIENTE") });
  });

  it("propaga el error de moneda distinta (LC_PAGO_MONEDA_CUENTA_MISMATCH)", async () => {
    mock.setRpcResult("ejecutar_pago_programado", {
      data: null,
      error: { message: "LC_PAGO_MONEDA_CUENTA_MISMATCH: La moneda de la cuenta (USD) no coincide con la de la factura (MXN)." },
    });

    await expect(
      ejecutarPagoProgramado({ facturaId: "f1", cuentaBancariaId: "c1", fecha: "2024-05-01", monto: 100 }),
    ).rejects.toMatchObject({ message: expect.stringContaining("LC_PAGO_MONEDA_CUENTA_MISMATCH") });
  });
});
