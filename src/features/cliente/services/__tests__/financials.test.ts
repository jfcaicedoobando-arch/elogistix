import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchClienteFinancials } from "@/features/cliente/services/financials";

beforeEach(() => {
  mock.rpcCalls.length = 0;
});

describe("fetchClienteFinancials", () => {
  it("convierte cada factura a MXN con su TC (Ola 6 · M1) y separa el pendiente", async () => {
    mock.setTableResult("facturas", {
      data: [
        { total: 100, moneda: "USD", tipo_cambio: 18, estado: "Emitida", embarque_id: "e1" },
        { total: 200, moneda: "MXN", tipo_cambio: null, estado: "Pagada", embarque_id: "e2" },
        { total: 50, moneda: "USD", tipo_cambio: 20, estado: "Vencida", embarque_id: "e3" },
      ],
      error: null,
    });
    mock.setRpcResult("profit_por_cliente", {
      data: [
        { cliente_id: "cli-1", venta_mxn: 5000, costo_mxn: 3000, embarques_sin_tc: 0 },
        { cliente_id: "cli-2", venta_mxn: 999, costo_mxn: 1, embarques_sin_tc: 3 },
      ],
      error: null,
    });
    const r = await fetchClienteFinancials("cli-1");
    // 100 USD × 18 + 200 MXN + 50 USD × 20 = 3,000
    expect(r.facturadoMXN).toBe(3000);
    expect(r.pendienteMXN).toBe(2800);
    expect(r.profitMXN).toBe(2000);
    expect(r.facturasSinTc).toBe(0);
    expect(r.embarquesSinTc).toBe(0);
  });

  it("excluye y cuenta las facturas en moneda extranjera sin TC confiable", async () => {
    mock.setTableResult("facturas", {
      data: [
        { total: 100, moneda: "USD", tipo_cambio: null, estado: "Emitida", embarque_id: "e1" },
        { total: 100, moneda: "USD", tipo_cambio: 1, estado: "Emitida", embarque_id: "e2" },
        { total: 300, moneda: "MXN", tipo_cambio: null, estado: "Emitida", embarque_id: "e3" },
      ],
      error: null,
    });
    mock.setRpcResult("profit_por_cliente", {
      data: [{ cliente_id: "cli-1", venta_mxn: 0, costo_mxn: 0, embarques_sin_tc: 2 }],
      error: null,
    });
    const r = await fetchClienteFinancials("cli-1");
    expect(r.facturadoMXN).toBe(300);
    expect(r.facturasSinTc).toBe(2);
    expect(r.embarquesSinTc).toBe(2);
  });

  it("utilidad = 0 cuando el cliente no aparece en la RPC", async () => {
    mock.setTableResult("facturas", { data: [], error: null });
    mock.setRpcResult("profit_por_cliente", { data: [], error: null });
    const r = await fetchClienteFinancials("desconocido");
    expect(r).toEqual({
      facturadoMXN: 0,
      pendienteMXN: 0,
      profitMXN: 0,
      facturasSinTc: 0,
      embarquesSinTc: 0,
    });
  });

  it("propaga error al consultar facturas del cliente", async () => {
    mock.setTableResult("facturas", { data: null, error: new Error("rls") });
    await expect(fetchClienteFinancials("x")).rejects.toThrow("rls");
  });

  it("propaga error de la RPC profit_por_cliente", async () => {
    mock.setTableResult("facturas", { data: [], error: null });
    mock.setRpcResult("profit_por_cliente", { data: null, error: new Error("rpc") });
    await expect(fetchClienteFinancials("x")).rejects.toThrow("rpc");
  });
});
