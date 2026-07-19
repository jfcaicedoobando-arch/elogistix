import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { listarPagosProveedor, registrarPagoProveedor, eliminarPagoProveedor as _eliminarPagoProveedor, PagoRequiereAprobacionError } from "../pagosProveedor";

describe("pagosProveedor service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  it("listarPagosProveedor filtra por facturaId", async () => {
    mock.setTableResult("pagos_proveedor", { data: [], error: null });
    await listarPagosProveedor("f1");
    const call = mock.tableCalls.find(c => c.table === "pagos_proveedor");
    expect(call?.ops).toContain("eq");
  });

  it("registrarPagoProveedor inserta payload con organization_id heredado del padre (recalculo lo hace el trigger)", async () => {
    mock.setTableResult("pagos_proveedor", { data: { id: "p1" }, error: null });
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

    const payload = mock.getMutationPayload("pagos_proveedor", "insert") as Record<string, unknown> | null;
    expect(payload).toBeTruthy();
    expect(payload).toMatchObject({
      organization_id: "org-1",
      proveedor_factura_id: "f1",
      fecha_pago: "2024-01-01",
      monto: 100,
      moneda: "MXN",
      metodo_pago: "Transferencia",
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
    mock.setTableResult("pagos_proveedor", { data: null, error: { message: "LC_PAGO_SIN_APROBACION: la factura F-1 está en estado pendiente" } });
    await expect(
      registrarPagoProveedor({ proveedor_factura_id: "f1", fecha_pago: "2024-01-01", monto: 10, moneda: "MXN", tipo_cambio_usd: 1, metodo_pago: "T" } as Parameters<typeof registrarPagoProveedor>[0], "u1"),
    ).rejects.toBeInstanceOf(PagoRequiereAprobacionError);
  });

  it("lanza error si falla insercion de pago", async () => {
    mock.setTableResult("proveedor_facturas", { data: { organization_id: "org-1", estado_aprobacion: "aprobada" }, error: null });
    mock.setRpcResult("current_user_org_id", { data: "org-1", error: null });
    mock.setTableResult("pagos_proveedor", { data: null, error: new Error("insert failed") });
    await expect(
      registrarPagoProveedor({ proveedor_factura_id: "f1" } as Parameters<typeof registrarPagoProveedor>[0], "u1"),
    ).rejects.toThrow("insert failed");
  });

});

