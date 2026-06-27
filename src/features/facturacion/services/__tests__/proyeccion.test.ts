import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchProyeccionMes } from "@/features/facturacion/services/proyeccion";

describe("fetchProyeccionMes", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.rpcCalls.length = 0;
    mock.resetResults();
    mock.rpcCalls.length = 0;
  });


  it("devuelve [] cuando no hay embarques en el mes", async () => {
    mock.setTableResult("embarques", { data: [], error: null });
    const r = await fetchProyeccionMes({ organizationId: "org-1", year: 2026, month: 5 });
    expect(r).toEqual([]);
  });

  it("marca tiene_factura_pdf=true cuando el expediente tiene factura con PDF", async () => {
    mock.setTableResult("embarques", {
      data: [
        { id: "e1", expediente: "EXP-1", cliente_nombre: "ACME", operador: "Op",
          eta: "2026-05-10", contenedor: "C1", tipo_cambio_usd: 20, tipo_cambio_eur: 22, tiene_proforma: true },
      ],
      error: null,
    });
    mock.setTableResult("conceptos_venta", {
      data: [{ embarque_id: "e1", total: 100, moneda: "USD" }],
      error: null,
    });
    mock.setTableResult("conceptos_costo", {
      data: [{ embarque_id: "e1", monto: 50, moneda: "USD" }],
      error: null,
    });
    mock.setTableResult("facturas", {
      data: [{ expediente: "EXP-1", factura_pdf_url: "f.pdf" }],
      error: null,
    });
    const [row] = await fetchProyeccionMes({ organizationId: "org-1", year: 2026, month: 5 });
    expect(row.tiene_factura_pdf).toBe(true);
    expect(row.tiene_proforma).toBe(true);
    expect(row.venta_usd).toBeCloseTo(100, 2);
    expect(row.costo_usd).toBeCloseTo(50, 2);
    expect(row.venta_mxn).toBeCloseTo(2000, 2);
  });

  it("agrupa conceptos por embarque correctamente", async () => {
    mock.setTableResult("embarques", {
      data: [
        { id: "e1", expediente: "X", cliente_nombre: "A", operador: "", eta: "2026-05-10",
          contenedor: null, tipo_cambio_usd: 20, tipo_cambio_eur: 22, tiene_proforma: false },
        { id: "e2", expediente: "Y", cliente_nombre: "B", operador: "", eta: "2026-05-15",
          contenedor: null, tipo_cambio_usd: 20, tipo_cambio_eur: 22, tiene_proforma: false },
      ],
      error: null,
    });
    mock.setTableResult("conceptos_venta", {
      data: [
        { embarque_id: "e1", total: 10, moneda: "USD" },
        { embarque_id: "e1", total: 5, moneda: "USD" },
        { embarque_id: "e2", total: 7, moneda: "USD" },
      ],
      error: null,
    });
    mock.setTableResult("conceptos_costo", { data: [], error: null });
    mock.setTableResult("facturas", { data: [], error: null });
    const rows = await fetchProyeccionMes({ organizationId: null, year: 2026, month: 5 });
    const e1 = rows.find((r) => r.embarque_id === "e1")!;
    const e2 = rows.find((r) => r.embarque_id === "e2")!;
    expect(e1.venta_usd).toBeCloseTo(15, 2);
    expect(e2.venta_usd).toBeCloseTo(7, 2);
  });

  it("propaga error de embarques", async () => {
    mock.setTableResult("embarques", { data: null, error: new Error("rls") });
    await expect(
      fetchProyeccionMes({ organizationId: "x", year: 2026, month: 1 }),
    ).rejects.toThrow("rls");
  });
});
