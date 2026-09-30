import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchFacturasReporte } from "@/features/compras/services/reportesFetch";

describe("fetchFacturasReporte", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
  });

  it("mapea filas y coerciona total a número", async () => {
    mock.setTableResult("proveedor_facturas", {
      data: [
        {
          id: "f1",
          fecha_emision: "2026-01-01",
          total: "123.45",
          moneda: "MXN",
          proveedor_id: "p1",
          proveedores: { nombre: "Naviera" },
        },
        {
          id: "f2",
          fecha_emision: null,
          total: 999,
          moneda: "USD",
          proveedor_id: null,
          proveedores: null,
        },
      ],
      error: null,
    });

    const res = await fetchFacturasReporte("2026-01-01", "2026-12-31");
    expect(res).toHaveLength(2);
    expect(res[0]).toMatchObject({
      id: "f1",
      total: 123.45,
      proveedor_nombre: "Naviera",
    });
    expect(res[1].proveedor_nombre).toBe("Sin proveedor");
    expect(res[1].total).toBe(999);
  });

  it("data vacía → []", async () => {
    mock.setTableResult("proveedor_facturas", { data: [], error: null });
    expect(await fetchFacturasReporte("a", "b")).toEqual([]);
  });

  it("propaga error del fetch de reporte", async () => {
    mock.setTableResult("proveedor_facturas", { data: null, error: new Error("db") });
    await expect(fetchFacturasReporte("a", "b")).rejects.toThrow("db");
  });

  it("consulta la tabla proveedor_facturas con filtros de fecha", async () => {
    mock.setTableResult("proveedor_facturas", { data: [], error: null });
    await fetchFacturasReporte("2026-01-01", "2026-01-31");
    const call = mock.tableCalls[0];
    expect(call.table).toBe("proveedor_facturas");
    expect(call.ops).toContain("gte");
    expect(call.ops).toContain("lte");
  });

  it("lee más de 2,000 facturas sin devolver un reporte parcial", async () => {
    const fila = (n: number) => ({
      id: `f-${n}`, fecha_emision: "2026-01-01", subtotal: 1, total: 1,
      moneda: "MXN", proveedor_id: null, proveedores: null,
    });
    mock.setTableResultOnce("proveedor_facturas", {
      data: Array.from({ length: 1000 }, (_, i) => fila(i)), error: null,
    });
    mock.setTableResultOnce("proveedor_facturas", {
      data: Array.from({ length: 1000 }, (_, i) => fila(i + 1000)), error: null,
    });
    mock.setTableResultOnce("proveedor_facturas", { data: [fila(2000)], error: null });
    const rows = await fetchFacturasReporte("2026-01-01", "2026-12-31");
    expect(rows).toHaveLength(2001);
    expect(rows.at(-1)?.id).toBe("f-2000");
    const ranges = mock.tableCalls.map((call) => call.opArgs[call.ops.indexOf("range")]);
    expect(ranges).toEqual([[0, 999], [1000, 1999], [2000, 2999]]);
    expect(mock.tableCalls.every((call) => call.ops.filter((op) => op === "order").length === 2)).toBe(true);
  });

  it("no suma un reporte parcial si falla una página posterior", async () => {
    mock.setTableResultOnce("proveedor_facturas", { data: Array.from({ length: 1000 }, (_, i) => ({ id: `f-${i}` })), error: null });
    mock.setTableResultOnce("proveedor_facturas", { data: null, error: new Error("segunda página") });
    await expect(fetchFacturasReporte("a", "b")).rejects.toThrow("segunda página");
  });
});
