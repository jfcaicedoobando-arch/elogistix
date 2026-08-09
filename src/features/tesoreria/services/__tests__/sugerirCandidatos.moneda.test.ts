/**
 * Ola 5 · M8 — el sugeridor de conciliación no debe cruzar monedas: un cargo en
 * una cuenta USD sólo puede emparejarse con pagos en USD.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { sugerirCandidatos, monedaDeCuenta } from "../sugerirCandidatos";
import type { MovimientoBBVA } from "../conciliacion";

// SAFE-CAST: sólo se leen cargo/abono/fecha/cuenta_bancaria_id del row.
const mov = (p: Partial<MovimientoBBVA>): MovimientoBBVA => p as MovimientoBBVA;

function monedaFiltrada(table: string): unknown {
  const call = mock.tableCalls.find((c) => c.table === table);
  const ops = call!.ops.map((op, i) => ({ op, args: call!.opArgs[i] }));
  return ops.find((o) => o.op === "eq" && o.args[0] === "moneda")?.args[1];
}

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.setTableResult("pagos_proveedor", { data: [], error: null });
  mock.setTableResult("pagos_factura", { data: [], error: null });
  mock.setTableResult("cuentas_bancarias", { data: { moneda: "USD" }, error: null });
});

describe("sugerirCandidatos — moneda", () => {
  it("filtra pagos de proveedor por la moneda de la cuenta (USD)", async () => {
    await sugerirCandidatos(mov({ cargo: 1000, abono: 0, fecha: "2026-06-10", cuenta_bancaria_id: "cta-usd" }));
    expect(monedaFiltrada("pagos_proveedor")).toBe("USD");
  });

  it("filtra cobros por la moneda de la cuenta (USD)", async () => {
    await sugerirCandidatos(mov({ cargo: 0, abono: 500, fecha: "2026-06-10", cuenta_bancaria_id: "cta-usd" }));
    expect(monedaFiltrada("pagos_factura")).toBe("USD");
  });

  it("usa la moneda recibida por parámetro sin consultar la cuenta", async () => {
    await sugerirCandidatos(mov({ cargo: 1000, abono: 0, fecha: "2026-06-10", cuenta_bancaria_id: "cta-usd" }), "MXN");
    expect(monedaFiltrada("pagos_proveedor")).toBe("MXN");
    expect(mock.tableCalls.find((c) => c.table === "cuentas_bancarias")).toBeUndefined();
  });

  it("monedaDeCuenta cae a MXN sin cuenta o con valor desconocido", async () => {
    expect(await monedaDeCuenta(null)).toBe("MXN");
    mock.setTableResult("cuentas_bancarias", { data: { moneda: "GBP" }, error: null });
    expect(await monedaDeCuenta("cta-x")).toBe("MXN");
  });
});
