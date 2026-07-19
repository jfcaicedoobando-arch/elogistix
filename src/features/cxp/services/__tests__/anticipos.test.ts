import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  registrarAnticipo,
  aplicarAnticipo,
  cancelarAnticipo,
  AnticipoError,
} from "../anticipos";

const PROV = "11111111-1111-1111-1111-111111111111";
const ANT = "22222222-2222-2222-2222-222222222222";
const FAC = "33333333-3333-3333-3333-333333333333";

describe("anticipos.ts - validaciones locales", () => {
  beforeEach(() => {
    mock.rpcCalls.length = 0;
  });

  it("registrarAnticipo rechaza proveedorId inválido", async () => {
    await expect(
      registrarAnticipo({ proveedorId: "no-uuid", monto: 100, moneda: "MXN" }),
    ).rejects.toMatchObject({ code: "INVALID_ID" });
  });

  it("registrarAnticipo rechaza monto ≤ 0", async () => {
    await expect(
      registrarAnticipo({ proveedorId: PROV, monto: 0, moneda: "MXN" }),
    ).rejects.toMatchObject({ code: "LC_ANTICIPO_MONTO_INVALIDO" });
  });

  it("aplicarAnticipo rechaza uuids inválidos", async () => {
    await expect(aplicarAnticipo("bad", FAC, 10)).rejects.toBeInstanceOf(AnticipoError);
    await expect(aplicarAnticipo(ANT, "bad", 10)).rejects.toBeInstanceOf(AnticipoError);
  });

  it("aplicarAnticipo rechaza monto ≤ 0", async () => {
    await expect(aplicarAnticipo(ANT, FAC, 0)).rejects.toMatchObject({
      code: "LC_ANTICIPO_MONTO_INVALIDO",
    });
  });

  it("cancelarAnticipo exige motivo ≥ 3 caracteres", async () => {
    await expect(cancelarAnticipo(ANT, " x ")).rejects.toMatchObject({
      code: "LC_ANTICIPO_MOTIVO_REQUERIDO",
    });
  });
});

describe("anticipos.ts - RPC + mapeo de errores", () => {
  beforeEach(() => {
    mock.rpcCalls.length = 0;
  });

  it("registrarAnticipo llama RPC y devuelve fila", async () => {
    mock.setRpcResult("registrar_anticipo_proveedor", {
      data: { id: ANT, proveedor_id: PROV, monto: 500, estado: "disponible" },
      error: null,
    });
    const row = await registrarAnticipo({ proveedorId: PROV, monto: 500, moneda: "MXN" });
    expect(row).toMatchObject({ id: ANT, estado: "disponible" });
    expect(mock.rpcCalls[0].fn).toBe("registrar_anticipo_proveedor");
  });

  it("aplicarAnticipo llama RPC con los args correctos", async () => {
    mock.setRpcResult("aplicar_anticipo_a_factura", {
      data: { id: "aa-1", anticipo_id: ANT, proveedor_factura_id: FAC },
      error: null,
    });
    await aplicarAnticipo(ANT, FAC, 100.5, "2026-07-19");
    const call = mock.rpcCalls[0];
    expect(call.fn).toBe("aplicar_anticipo_a_factura");
    expect(call.args).toMatchObject({
      p_anticipo_id: ANT,
      p_factura_id: FAC,
      p_monto: 100.5,
      p_fecha_aplicacion: "2026-07-19",
    });
  });

  it("cancelarAnticipo llama RPC con motivo trimmed", async () => {
    mock.setRpcResult("cancelar_anticipo_proveedor", {
      data: { id: ANT, estado: "cancelado" },
      error: null,
    });
    await cancelarAnticipo(ANT, "  duplicado  ");
    const call = mock.rpcCalls[0].args as { p_motivo: string };
    expect(call.p_motivo).toBe("duplicado");
  });

  it.each([
    [{ message: "LC_ANTICIPO_SIN_ROL: no autorizado" }, "LC_ANTICIPO_SIN_ROL"],
    [{ message: "LC_ANTICIPO_SIN_SALDO: 100 vs 50" }, "LC_ANTICIPO_SIN_SALDO"],
    [{ message: "LC_ANTICIPO_FACTURA_INVALIDA: no aprobada" }, "LC_ANTICIPO_FACTURA_INVALIDA"],
    [{ message: "LC_ANTICIPO_YA_CANCELADO: x" }, "LC_ANTICIPO_YA_CANCELADO"],
    [{ message: "LC_ANTICIPO_CON_APLICACIONES: x" }, "LC_ANTICIPO_CON_APLICACIONES"],
    [{ message: "LC_ANTICIPO_PROVEEDOR_MISMATCH: x" }, "LC_ANTICIPO_PROVEEDOR_MISMATCH"],
    [{ message: "LC_ANTICIPO_ORG_MISMATCH: x" }, "LC_ANTICIPO_ORG_MISMATCH"],
    [{ message: "LC_PAGO_TC_REQUERIDO: falta tc" }, "LC_PAGO_TC_REQUERIDO"],
    [{ message: "LC_PAGO_CRUCE_NO_SOPORTADO: eur" }, "LC_PAGO_CRUCE_NO_SOPORTADO"],
    [{ message: "boom" }, "UNKNOWN"],
  ])("mapea error RPC %j → %s", async (rpcError, expectedCode) => {
    mock.setRpcResult("aplicar_anticipo_a_factura", { data: null, error: rpcError });
    await expect(aplicarAnticipo(ANT, FAC, 10)).rejects.toMatchObject({ code: expectedCode });
  });
});
