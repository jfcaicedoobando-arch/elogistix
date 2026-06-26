/**
 * Tests para `fetchCostosConFactura` — regresión de PGRST200 (Sentry
 * JAVASCRIPT-REACT-1M). Verifica el patrón de dos pasos sin embed.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});

vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchCostosConFactura } from "../costosConFactura";

describe("fetchCostosConFactura", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  it("retorna set vacío si el embarqueId es falsy", async () => {
    const out = await fetchCostosConFactura("");
    expect(out.size).toBe(0);
    expect(mock.tableCalls).toHaveLength(0);
  });

  it("retorna set vacío si el embarque no tiene conceptos_costo", async () => {
    mock.setTableResult("conceptos_costo", { data: [], error: null });
    const out = await fetchCostosConFactura("emb-1");
    expect(out.size).toBe(0);
  });

  it("regresa los concepto_costo_id que tienen factura vinculada", async () => {
    mock.setTableResult("conceptos_costo", {
      data: [{ id: "cc-1" }, { id: "cc-2" }, { id: "cc-3" }],
      error: null,
    });
    mock.setTableResult("proveedor_facturas_conceptos", {
      data: [
        { concepto_costo_id: "cc-1" },
        { concepto_costo_id: "cc-1" },
        { concepto_costo_id: "cc-3" },
        { concepto_costo_id: null },
      ],
      error: null,
    });
    const out = await fetchCostosConFactura("emb-1");
    expect(Array.from(out).sort()).toEqual(["cc-1", "cc-3"]);
  });

  it("propaga error del paso conceptos_costo", async () => {
    mock.setTableResult("conceptos_costo", { data: null, error: { message: "boom" } });
    await expect(fetchCostosConFactura("emb-1")).rejects.toBeTruthy();
  });

  it("propaga error del paso proveedor_facturas_conceptos", async () => {
    mock.setTableResult("conceptos_costo", { data: [{ id: "cc-1" }], error: null });
    mock.setTableResult("proveedor_facturas_conceptos", {
      data: null,
      error: { message: "boom" },
    });
    await expect(fetchCostosConFactura("emb-1")).rejects.toBeTruthy();
  });
});
