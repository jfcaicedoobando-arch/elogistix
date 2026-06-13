import { describe, it, expect, beforeEach, vi } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { sugerirCandidatos } from "../sugerirCandidatos";
import type { MovimientoBBVA } from "../conciliacion";

// SAFE-CAST: Tables<"bbva_movimientos"> tiene >15 columnas no relevantes para la
// lógica testeada (sólo se leen `cargo`, `abono`, `fecha`). Mantener un objeto
// parcial cast como `MovimientoBBVA` es más mantenible que stubear todo el row.
function mov(partial: Partial<MovimientoBBVA>): MovimientoBBVA {
  return partial as MovimientoBBVA;
}

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("sugerirCandidatos (helpers)", () => {
  it("devuelve [] cuando cargo y abono son 0", async () => {
    const res = await sugerirCandidatos(mov({ cargo: 0, abono: 0, fecha: "2026-06-10" }));
    expect(res).toEqual([]);
    expect(mock.tableCalls).toHaveLength(0);
  });

  it("cargo bancario consulta pagos_proveedor con tolerancia ±1 monto y ±5 días", async () => {
    mock.setTableResult("pagos_proveedor", { data: [], error: null });
    await sugerirCandidatos(mov({ cargo: 1000, abono: 0, fecha: "2026-06-10" }));
    const call = mock.tableCalls.find((c) => c.table === "pagos_proveedor");
    expect(call).toBeDefined();
    const argMap = new Map(call!.ops.map((op, i) => [op + ":" + JSON.stringify(call!.opArgs[i]), true]));
    // Verifica que se hayan aplicado filtros gte/lte de monto y fecha.
    expect(call!.ops.filter((o) => o === "gte")).toHaveLength(2);
    expect(call!.ops.filter((o) => o === "lte")).toHaveLength(2);
    // Confirma valores límite por monto
    const opsConArgs = call!.ops.map((op, i) => ({ op, args: call!.opArgs[i] }));
    const montoMin = opsConArgs.find((o) => o.op === "gte" && o.args[0] === "monto");
    const montoMax = opsConArgs.find((o) => o.op === "lte" && o.args[0] === "monto");
    expect(montoMin?.args[1]).toBe(999);
    expect(montoMax?.args[1]).toBe(1001);
    // Confirma fechas ±5 días
    const fechaMin = opsConArgs.find((o) => o.op === "gte" && o.args[0] === "fecha_pago");
    const fechaMax = opsConArgs.find((o) => o.op === "lte" && o.args[0] === "fecha_pago");
    expect(fechaMin?.args[1]).toBe("2026-06-05");
    expect(fechaMax?.args[1]).toBe("2026-06-15");
    expect(argMap.size).toBeGreaterThan(0);
  });

  it("mapea candidatos cxp con delta_dias y delta_monto absolutos", async () => {
    mock.setTableResult("pagos_proveedor", {
      data: [
        {
          id: "p1",
          fecha_pago: "2026-06-12",
          monto: 1000.5,
          moneda: "MXN",
          referencia: "TR-1",
          proveedor_facturas: { proveedor_nombre: "Acme SA" },
        },
      ],
      error: null,
    });
    const res = await sugerirCandidatos(mov({ cargo: 1000, abono: 0, fecha: "2026-06-10" }));
    expect(res).toHaveLength(1);
    expect(res[0]).toMatchObject({
      tipo: "cxp",
      pago_id: "p1",
      contraparte: "Acme SA",
      delta_dias: 2,
    });
    expect(res[0].delta_monto).toBeCloseTo(0.5, 2);
  });

  it("abono bancario consulta pagos_factura (no proveedor)", async () => {
    mock.setTableResult("pagos_factura", { data: [], error: null });
    await sugerirCandidatos(mov({ cargo: 0, abono: 500, fecha: "2026-06-10" }));
    const calls = mock.tableCalls.map((c) => c.table);
    expect(calls).toContain("pagos_factura");
    expect(calls).not.toContain("pagos_proveedor");
  });

  it("mapea candidatos cxc con contraparte por defecto '—' cuando facturas es null", async () => {
    mock.setTableResult("pagos_factura", {
      data: [
        {
          id: "f1",
          fecha_pago: "2026-06-10",
          monto: 500,
          moneda: "USD",
          referencia: null,
          facturas: null,
        },
      ],
      error: null,
    });
    const res = await sugerirCandidatos(mov({ cargo: 0, abono: 500, fecha: "2026-06-10" }));
    expect(res[0]).toMatchObject({
      tipo: "cxc",
      contraparte: "—",
      referencia: "",
      delta_dias: 0,
      delta_monto: 0,
    });
  });

  it("ordena por delta_monto y luego por delta_dias asc", async () => {
    mock.setTableResult("pagos_proveedor", {
      data: [
        { id: "p1", fecha_pago: "2026-06-08", monto: 1001, moneda: "MXN", referencia: "A", proveedor_facturas: null },
        { id: "p2", fecha_pago: "2026-06-10", monto: 1000, moneda: "MXN", referencia: "B", proveedor_facturas: null },
        { id: "p3", fecha_pago: "2026-06-11", monto: 1000, moneda: "MXN", referencia: "C", proveedor_facturas: null },
      ],
      error: null,
    });
    const res = await sugerirCandidatos(mov({ cargo: 1000, abono: 0, fecha: "2026-06-10" }));
    expect(res.map((r) => r.pago_id)).toEqual(["p2", "p3", "p1"]);
  });
});
