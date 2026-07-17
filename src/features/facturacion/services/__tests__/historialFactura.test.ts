import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchHistorialFacturaEmitida } from "../historialFactura";

describe("fetchHistorialFacturaEmitida", () => {
  beforeEach(() => {
    mock.rpcCalls.length = 0;
    mock.resetResults();
  });

  it("invoca RPC segura con factura y límite", async () => {
    mock.setRpcResult("historial_factura", { data: [], error: null });

    await fetchHistorialFacturaEmitida("factura-1", 25);

    expect(mock.rpcCalls[0]).toEqual({
      fn: "historial_factura",
      args: { p_factura_id: "factura-1", p_limite: 25 },
    });
  });

  it("normaliza detalles no-objeto a objeto vacío", async () => {
    mock.setRpcResult("historial_factura", {
      data: [
        {
          id: "b1",
          usuario_id: "u1",
          usuario_email: "u@test.mx",
          accion: "facturapi_emitida",
          modulo: "facturacion",
          entidad_id: "factura-1",
          entidad_nombre: "F975",
          detalles: null,
          created_at: "2026-07-17T00:00:00Z",
        },
      ],
      error: null,
    });

    const rows = await fetchHistorialFacturaEmitida("factura-1");

    expect(rows[0].detalles).toEqual({});
  });

  it("propaga errores de la RPC", async () => {
    mock.setRpcResult("historial_factura", { data: null, error: { message: "boom" } });

    await expect(fetchHistorialFacturaEmitida("factura-1")).rejects.toMatchObject({
      message: "boom",
    });
  });
});