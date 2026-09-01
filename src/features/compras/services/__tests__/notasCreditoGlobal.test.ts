import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { listarNotasCreditoGlobal } from "../notasCreditoGlobal";

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
    motivo: "Error", estado: "Emitida", descripcion: "Duplicada",
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
    expect(call?.ops).toContain("limit");
  });


  it("propaga error del cliente Supabase (notas de crédito)", async () => {
    mock.setTableResult("proveedor_notas_credito", { data: null, error: { message: "boom" } });
    await expect(listarNotasCreditoGlobal()).rejects.toMatchObject({ message: "boom" });
  });
});
