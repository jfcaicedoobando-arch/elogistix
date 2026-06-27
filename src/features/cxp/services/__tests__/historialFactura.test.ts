import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchHistorialFactura } from "../historialFactura";

describe("fetchHistorialFactura", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  it("invoca RPC con p_id y retorna eventos", async () => {
    const rows = [
      { ts: "2026-01-01T10:00:00Z", tipo: "creada", descripcion: "x", actor_email: "a@x", monto: null, moneda: null, detalles: {} },
      { ts: "2026-01-02T10:00:00Z", tipo: "pago", descripcion: "y", actor_email: "b@x", monto: 100, moneda: "MXN", detalles: { ref: 1 } },
    ];
    mock.setRpcResult("historial_proveedor_factura", { data: rows, error: null });
    const r = await fetchHistorialFactura("f1");
    expect(r).toHaveLength(2);
    expect(r[1].monto).toBe(100);
  });

  it("retorna [] cuando data es null", async () => {
    mock.setRpcResult("historial_proveedor_factura", { data: null, error: null });
    expect(await fetchHistorialFactura("f1")).toEqual([]);
  });

  it("propaga error", async () => {
    mock.setRpcResult("historial_proveedor_factura", { data: null, error: { message: "boom" } });
    await expect(fetchHistorialFactura("f1")).rejects.toMatchObject({ message: "boom" });
  });
});
