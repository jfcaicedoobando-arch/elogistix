/** Sentry 8F: un vendedor sin acceso a Rentabilidad ve la ficha sin error. */
import { describe, it, expect, vi } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchClienteFinancials } from "@/features/cliente/services/financials";

describe("fetchClienteFinancials sin permiso de Rentabilidad", () => {
  it("devuelve facturado y deja la utilidad en null", async () => {
    mock.setTableResult("facturas", {
      data: [{ total: 100, moneda: "MXN", tipo_cambio: null, estado: "Emitida", embarque_id: "e1" }],
      error: null,
    });
    mock.setRpcResult("profit_por_cliente", {
      data: null,
      error: { code: "42501", message: "LC_PROFIT_ROLE_REQUIRED" },
    });
    const r = await fetchClienteFinancials("cli-1");
    expect(r.facturadoMXN).toBe(100);
    expect(r.profitMXN).toBeNull();
  });

  it("otro error de la consulta sí se lanza", async () => {
    mock.setTableResult("facturas", { data: [], error: null });
    mock.setRpcResult("profit_por_cliente", {
      data: null,
      error: { code: "57014", message: "canceling statement due to statement timeout" },
    });
    await expect(fetchClienteFinancials("cli-1")).rejects.toMatchObject({ code: "57014" });
  });
});
