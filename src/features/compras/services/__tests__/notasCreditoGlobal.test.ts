import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { listarNotasCreditoGlobal, listarNotasCreditoGlobalPagina } from "../notasCreditoGlobal";

const SAMPLE = [
  {
    id: "nc1", folio_nc: "NC-001", fecha: "2026-06-10", monto: "100", moneda: "MXN",
    motivo: "Descuento", estado: "Aplicada", descripcion: null,
    proveedor_factura_id: "f1",
    proveedor_facturas: {
      folio_interno: "FP-000001", folio_proveedor: "A-100",
      proveedor_id: "prov-1", proveedores: { nombre: "ACME SA" },
    },
  },
  {
    id: "nc2", folio_nc: "NC-002", fecha: "2026-06-05", monto: "50", moneda: "USD",
    motivo: "Error", estado: "Aprobada", descripcion: "Duplicada",
    proveedor_factura_id: "f2",
    proveedor_facturas: {
      folio_interno: "FP-000002", folio_proveedor: "B-200",
      proveedor_id: "prov-2", proveedores: { nombre: "Global Logistics" },
    },
  },
];

describe("listarNotasCreditoGlobal", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.resetResults();
    mock.setTableResult("proveedor_notas_credito", { data: SAMPLE, error: null });
  });

  it("mapea el DTO plano con proveedor y factura", async () => {
    const rows = await listarNotasCreditoGlobal();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "nc1", folio_nc: "NC-001", monto: 100, estado: "Aplicada",
      proveedor_nombre: "ACME SA", factura_folio_interno: "FP-000001",
    });
  });

  it("58: conserva las tasas guardadas y expone MXN2000 equivalentes a USD100", async () => {
    mock.setTableResult("proveedor_notas_credito", { data: [{
      ...SAMPLE[0], monto: "2000", tipo_cambio: 20,
      proveedor_facturas: { ...SAMPLE[0].proveedor_facturas, moneda: "USD", tipo_cambio_usd: 20 },
    }], error: null });
    const [r] = await listarNotasCreditoGlobal();
    expect(r).toMatchObject({ monto: 2000, moneda: "MXN", tipo_cambio: 20, factura_moneda: "USD", factura_tipo_cambio: 20, monto_en_moneda_factura: 100 });
    const select = mock.tableCalls[0].opArgs[mock.tableCalls[0].ops.indexOf("select")][0];
    expect(select).toContain("tipo_cambio");
    expect(select).toContain("moneda, tipo_cambio_usd");
    expect(mock.tableCalls.every((c) => !c.ops.some((op) => ["update", "insert", "delete"].includes(op)))).toBe(true);
  });

  it("58: un TC faltante deja equivalente no disponible y conserva el monto nominal", async () => {
    mock.setTableResult("proveedor_notas_credito", { data: [{
      ...SAMPLE[0], monto: "2000", tipo_cambio: null,
      proveedor_facturas: { ...SAMPLE[0].proveedor_facturas, moneda: "USD", tipo_cambio_usd: 20 },
    }], error: null });
    const [r] = await listarNotasCreditoGlobal();
    expect(r.monto).toBe(2000);
    expect(r.monto_en_moneda_factura).toBeNull();
  });
  it("58: NC MXN2000 TC25 equivale USD80 aunque la factura tenga TC20", async () => {
    mock.setTableResult("proveedor_notas_credito", { data: [{
      ...SAMPLE[0], monto: "2000", tipo_cambio: 25,
      proveedor_facturas: { ...SAMPLE[0].proveedor_facturas, moneda: "USD", tipo_cambio_usd: 20 },
    }], error: null });
    expect((await listarNotasCreditoGlobal())[0]).toMatchObject({ tipo_cambio: 25, factura_tipo_cambio: 20, monto_en_moneda_factura: 80 });
  });

  // M-4 (auditoría v14): filtros server-side antes del LIMIT.
  it("notas de crédito: filtra por proveedor server-side (columna embebida)", async () => {
    await listarNotasCreditoGlobal({ proveedorId: "prov-2" });
    const call = mock.tableCalls.find((c) => c.table === "proveedor_notas_credito");
    expect(call?.opArgs).toEqual(
      expect.arrayContaining([["proveedor_facturas.proveedor_id", "prov-2"]]),
    );
  });

  it("notas de crédito: aplica la búsqueda server-side antes del límite", async () => {
    await listarNotasCreditoGlobal({ search: "duplicada" });
    const call = mock.tableCalls.find((c) => c.table === "proveedor_notas_credito");
    expect(call?.ops.some((op) => op === "or" || op === "ilike")).toBe(true);
    expect(call?.ops).toContain("range");
  });


  // P2-9 (v13.821.7): paginación real, sin tope silencioso a 1000.
  it("devuelve count exacto y respeta el rango pedido", async () => {
    mock.setTableResult("proveedor_notas_credito", { data: SAMPLE, error: null, count: 2300 } as never);
    const pagina = await listarNotasCreditoGlobalPagina({}, null, { from: 2200, to: 2299 });
    expect(pagina.count).toBe(2300);
    const call = mock.tableCalls.find((c) => c.table === "proveedor_notas_credito");
    const iRange = call!.ops.indexOf("range");
    expect(call!.opArgs[iRange]).toEqual([2200, 2299]);
  });

  it("propaga error del cliente Supabase (notas de crédito)", async () => {
    mock.setTableResult("proveedor_notas_credito", { data: null, error: { message: "boom" } });
    await expect(listarNotasCreditoGlobal()).rejects.toMatchObject({ message: "boom" });
  });
});
