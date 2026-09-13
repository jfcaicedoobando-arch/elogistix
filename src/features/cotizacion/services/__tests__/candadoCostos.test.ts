/**
 * v13.823.357 (Auditoría YAGNI P1 #4): el candado de costos falla CERRADO.
 * Antes un error de consulta devolvía `true` y dejaba convertir una cotización
 * sin costos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));
vi.mock("@/lib/observability/reportCaughtError", () => ({ reportCaughtError: vi.fn() }));

import { tieneCostosCargados, CandadoCostosNoVerificableError } from "../candadoCostos";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.resetResults();
});

describe("tieneCostosCargados (candado de costos)", () => {
  it("devuelve true cuando hay filas de costo", async () => {
    mock.setTableResult("cotizacion_costos", { data: null, error: null, count: 3 });
    await expect(tieneCostosCargados("cot-1")).resolves.toBe(true);
  });

  it("devuelve false cuando no hay filas de costo", async () => {
    mock.setTableResult("cotizacion_costos", { data: null, error: null, count: 0 });
    await expect(tieneCostosCargados("cot-2")).resolves.toBe(false);
  });

  it("falla cerrado (error reintentable) cuando la consulta falla", async () => {
    mock.setTableResult("cotizacion_costos", { data: null, error: { message: "network down" }, count: null });
    await expect(tieneCostosCargados("cot-3")).rejects.toBeInstanceOf(CandadoCostosNoVerificableError);
  });
});
