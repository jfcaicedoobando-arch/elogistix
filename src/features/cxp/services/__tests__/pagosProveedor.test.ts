import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { listarPagosProveedor, registrarPagoProveedor, eliminarPagoProveedor as _eliminarPagoProveedor } from "../pagosProveedor";

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

  it("registrarPagoProveedor inserta payload con monto/fecha/factura y recalcula factura", async () => {
    mock.setTableResult("pagos_proveedor", { data: { id: "p1" }, error: null });
    mock.setTableResult("v_proveedor_facturas_saldo", { data: { saldo: 0 }, error: null });
    mock.setTableResult("proveedor_facturas", { data: { estado: "Vigente" }, error: null });

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

    // Verificar payload escrito (Sprint 4 D-14: servicio crítico de pagos).
    const payload = mock.getMutationPayload("pagos_proveedor", "insert") as Record<string, unknown> | null;
    expect(payload).toBeTruthy();
    expect(payload).toMatchObject({
      proveedor_factura_id: "f1",
      fecha_pago: "2024-01-01",
      monto: 100,
      moneda: "MXN",
      metodo_pago: "Transferencia",
    });
    expect(mock.tableCalls.some(c => c.table === "v_proveedor_facturas_saldo")).toBe(true);
  });

  it("lanza error si falla insercion de pago", async () => {
    mock.setTableResult("pagos_proveedor", { data: null, error: new Error("insert failed") });
    await expect(registrarPagoProveedor({} as any, "u1")).rejects.toThrow("insert failed");
  });
});
