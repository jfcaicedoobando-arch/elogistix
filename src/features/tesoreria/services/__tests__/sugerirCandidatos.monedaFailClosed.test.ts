import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { sugerirCandidatos, monedaDeCuenta } from "../sugerirCandidatos";
import type { MovimientoBBVA } from "../conciliacion";

const mov = (p: Partial<MovimientoBBVA>): MovimientoBBVA => p as MovimientoBBVA;

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.resetResults();
  mock.setTableResult("pagos_proveedor", { data: [], error: null });
  mock.setTableResult("pagos_factura", { data: [], error: null });
});

describe("sugerirCandidatos / monedaDeCuenta — EC-04 fail-closed", () => {
  it("monedaDeCuenta propaga el error en vez de caer a MXN", async () => {
    mock.setTableResult("cuentas_bancarias", { data: null, error: { message: "timeout" } });
    await expect(monedaDeCuenta("cta-1")).rejects.toThrow();
  });

  it("sugerirCandidatos aborta (no sugiere) cuando falla el lookup de la cuenta", async () => {
    mock.setTableResult("cuentas_bancarias", { data: null, error: { message: "timeout" } });
    await expect(
      sugerirCandidatos(mov({ cargo: 1000, abono: 0, fecha: "2026-06-10", cuenta_bancaria_id: "cta-1" })),
    ).rejects.toThrow();
    expect(mock.tableCalls.find((c) => c.table === "pagos_proveedor")).toBeUndefined();
  });
});
