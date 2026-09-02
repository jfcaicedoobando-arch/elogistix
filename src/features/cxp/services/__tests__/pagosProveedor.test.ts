import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { listarPagosProveedor, registrarPagoProveedor, eliminarPagoProveedor, PagoRequiereAprobacionError } from "../pagosProveedor";

describe("pagosProveedor service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.rpcCalls.length = 0;
    mock.resetResults();
  });

  it("listarPagosProveedor filtra por facturaId", async () => {
    mock.setTableResult("pagos_proveedor", { data: [], error: null });
    await listarPagosProveedor("f1");
    const call = mock.tableCalls.find(c => c.table === "pagos_proveedor");
    expect(call?.ops).toContain("eq");
  });

  it("v13.823.32: registrarPagoProveedor delega en la RPC atómica y devuelve el pago creado", async () => {
    mock.setTableResult("pagos_proveedor", { data: { id: "p1", organization_id: "org-1" }, error: null });
    mock.setRpcResult("registrar_pago_proveedor_atomico", { data: { pago_id: "p1", movimiento_id: "m1" }, error: null });
    mock.setTableResult("proveedor_facturas", { data: { organization_id: "org-1", estado_aprobacion: "aprobada" }, error: null });
    mock.setRpcResult("current_user_org_id", { data: "org-1", error: null });

    const input = {
      proveedor_factura_id: "f1",
      fecha_pago: "2024-01-01",
      monto: 100,
      moneda: "MXN",
      tipo_cambio_usd: 1,
      metodo_pago: "Transferencia",
    } as Parameters<typeof registrarPagoProveedor>[0];

    const res = await registrarPagoProveedor(input, "u1");
    expect(res.id).toBe("p1");

    // Ya no hay INSERT directo desde el cliente: todo va por la RPC.
    expect(mock.getMutationPayload("pagos_proveedor", "insert")).toBeFalsy();
    const rpc = mock.rpcCalls.find(c => c.fn === "registrar_pago_proveedor_atomico");
    expect(rpc?.args).toMatchObject({
      p_factura_id: "f1",
      p_fecha_pago: "2024-01-01",
      p_monto: 100,
      p_moneda: "MXN",
      p_metodo_pago: "Transferencia",
    });
    expect(mock.tableCalls.some(c => c.table === "v_proveedor_facturas_saldo")).toBe(false);
  });

  it("aborta con ORG_MISMATCH si la org actual difiere de la del padre", async () => {
    mock.setTableResult("proveedor_facturas", { data: { organization_id: "org-A", estado_aprobacion: "aprobada" }, error: null });
    mock.setRpcResult("current_user_org_id", { data: "org-B", error: null });
    await expect(
      registrarPagoProveedor({ proveedor_factura_id: "f1" } as Parameters<typeof registrarPagoProveedor>[0], "u1"),
    ).rejects.toMatchObject({ code: "ORG_MISMATCH" });
  });

  it("lanza NOT_FOUND si la factura padre no existe", async () => {
    mock.setTableResult("proveedor_facturas", { data: null, error: null });
    await expect(
      registrarPagoProveedor({ proveedor_factura_id: "f1" } as Parameters<typeof registrarPagoProveedor>[0], "u1"),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("R.4 · Bug 24: factura pendiente lanza PagoRequiereAprobacionError sin insertar", async () => {
    mock.setTableResult("proveedor_facturas", { data: { organization_id: "org-1", estado_aprobacion: "pendiente" }, error: null });
    mock.setRpcResult("current_user_org_id", { data: "org-1", error: null });
    await expect(
      registrarPagoProveedor({ proveedor_factura_id: "f1" } as Parameters<typeof registrarPagoProveedor>[0], "u1"),
    ).rejects.toBeInstanceOf(PagoRequiereAprobacionError);
    // No hubo insert en pagos_proveedor.
    expect(mock.getMutationPayload("pagos_proveedor", "insert")).toBeFalsy();
  });

  it("R.4 · Bug 24: mapea LC_PAGO_SIN_APROBACION del trigger BD al error tipado", async () => {
    mock.setTableResult("proveedor_facturas", { data: { organization_id: "org-1", estado_aprobacion: "aprobada" }, error: null });
    mock.setRpcResult("current_user_org_id", { data: "org-1", error: null });
    mock.setRpcResult("registrar_pago_proveedor_atomico", { data: null, error: { message: "LC_PAGO_SIN_APROBACION: la factura F-1 está en estado pendiente" } });
    await expect(
      registrarPagoProveedor({ proveedor_factura_id: "f1", fecha_pago: "2024-01-01", monto: 10, moneda: "MXN", tipo_cambio_usd: 1, metodo_pago: "T" } as Parameters<typeof registrarPagoProveedor>[0], "u1"),
    ).rejects.toBeInstanceOf(PagoRequiereAprobacionError);
  });

  it("lanza error si falla el registro del pago", async () => {
    mock.setTableResult("proveedor_facturas", { data: { organization_id: "org-1", estado_aprobacion: "aprobada" }, error: null });
    mock.setRpcResult("current_user_org_id", { data: "org-1", error: null });
    mock.setRpcResult("registrar_pago_proveedor_atomico", { data: null, error: new Error("insert failed") });
    await expect(
      registrarPagoProveedor({ proveedor_factura_id: "f1" } as Parameters<typeof registrarPagoProveedor>[0], "u1"),
    ).rejects.toThrow("insert failed");
  });

  it("Ola 15 · eliminarPagoProveedor delega todo en la RPC atómica", async () => {
    mock.setRpcResult("eliminar_pago_proveedor", {
      data: { movimientos_baja: 0, movimientos_desvinculados: 1, costos_recalculados: 2, ya_eliminado: false },
      error: null,
    });
    const r = await eliminarPagoProveedor("p1", "f1", "u1");
    expect(r).toEqual({
      movimientosBaja: 0,
      movimientosDesvinculados: 1,
      costosRecalculados: 2,
      yaEliminado: false,
    });
    expect(mock.rpcCalls.some((c) => c.fn === "eliminar_pago_proveedor" && (c.args as { _pago_id: string })._pago_id === "p1")).toBe(true);
    // Ningún UPDATE directo desde el cliente.
    expect(mock.tableCalls.filter((c) => c.ops.includes("update"))).toHaveLength(0);
  });

  it("propaga el error de la RPC al eliminar un pago", async () => {
    mock.setRpcResult("eliminar_pago_proveedor", { data: null, error: new Error("LC_SOD_VIOLATION") });
    await expect(eliminarPagoProveedor("p1", "f1", "u1")).rejects.toThrow("LC_SOD_VIOLATION");
  });

});

