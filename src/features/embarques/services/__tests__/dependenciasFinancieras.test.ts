import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

// Helper to override "from(table)" with custom count per table
function setEmpty(table: string) {
  mock.setTableResult(table, { data: [], error: null });
}

import { fetchEmbarqueDependenciasFinancieras } from "@/features/embarques/services/dependenciasFinancieras";

beforeEach(() => {
  mock.resetResults();
  mock.tableCalls.length = 0;
});

describe("fetchEmbarqueDependenciasFinancieras", () => {
  it("sin dependencias devuelve tieneDependencias=false", async () => {
    setEmpty("facturas");
    setEmpty("proveedor_facturas");
    const r = await fetchEmbarqueDependenciasFinancieras("e1");
    expect(r.tieneDependencias).toBe(false);
    expect(r.cxc.count).toBe(0);
    expect(r.cxp.count).toBe(0);
  });

  it("con facturas CxC marca dependencias", async () => {
    mock.setTableResult("facturas", {
      data: [{ id: "f1", numero: "F-001", estado: "Emitida" }],
      error: null,
    });
    mock.setTableResult("proveedor_facturas", { data: [], error: null });
    mock.setTableResult("factura_notas_credito", { data: [], error: null });
    mock.setTableResult("pagos_factura", { data: [], error: null });
    const r = await fetchEmbarqueDependenciasFinancieras("e1");
    expect(r.tieneDependencias).toBe(true);
    expect(r.cxc.facturas[0].folio).toBe("F-001");
  });

  it("propaga error de facturas en dependencias financieras del embarque", async () => {
    mock.setTableResult("facturas", { data: null, error: { message: "boom" } });
    await expect(fetchEmbarqueDependenciasFinancieras("e1")).rejects.toThrow();
  });
});
