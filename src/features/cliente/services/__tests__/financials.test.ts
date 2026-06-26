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
  it("suma facturado total y pendiente sólo de Emitida/Vencida", async () => {
    mock.setTableResult("facturas", {
      data: [
        { total: 100, moneda: "USD", estado: "Emitida", embarque_id: "e1" },
        { total: 200, moneda: "USD", estado: "Pagada", embarque_id: "e2" },
        { total: 50, moneda: "USD", estado: "Vencida", embarque_id: "e3" },
      ],
      error: null,
    });
    mock.setRpcResult("profit_por_cliente", {
      data: [
        { cliente_id: "cli-1", venta_usd: 500, costo_usd: 300 },
        { cliente_id: "cli-2", venta_usd: 999, costo_usd: 1 },
      ],
      error: null,
    });
    const r = await fetchClienteFinancials("cli-1");
    expect(r.facturadoUSD).toBe(350);
    expect(r.pendienteUSD).toBe(150);
    expect(r.profitUSD).toBe(200);
  });

  it("profit = 0 cuando el cliente no aparece en la RPC", async () => {
    mock.setTableResult("facturas", { data: [], error: null });
    mock.setRpcResult("profit_por_cliente", { data: [], error: null });
    const r = await fetchClienteFinancials("desconocido");
    expect(r).toEqual({ facturadoUSD: 0, pendienteUSD: 0, profitUSD: 0 });
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
