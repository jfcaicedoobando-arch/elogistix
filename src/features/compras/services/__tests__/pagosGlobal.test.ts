import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { listarPagosProveedorGlobal } from "../pagosGlobal";

const SAMPLE = [
  {
    id: "p1", fecha_pago: "2026-06-10", monto: "1500.50", moneda: "MXN",
    tipo_cambio_usd: null, metodo_pago: "SPEI", referencia: "REF-001",
    cuenta_bancaria_id: null, proveedor_factura_id: "f1",
    proveedor_facturas: {
      folio_interno: "FP-000001", folio_proveedor: "A-100", total: "1500.50",
      proveedor_id: "prov-1", proveedores: { nombre: "ACME SA" },
    },
  },
  {
    id: "p2", fecha_pago: "2026-06-05", monto: "500", moneda: "USD",
    tipo_cambio_usd: "17.5", metodo_pago: "Transferencia", referencia: null,
    cuenta_bancaria_id: null, proveedor_factura_id: "f2",
    proveedor_facturas: {
      folio_interno: "FP-000002", folio_proveedor: "B-200", total: "500",
      proveedor_id: "prov-2", proveedores: { nombre: "Global Logistics" },
    },
  },
];

describe("listarPagosProveedorGlobal", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.resetResults();
    mock.setTableResult("pagos_proveedor", { data: SAMPLE, error: null });
  });

  it("mapea las filas anidadas al DTO plano", async () => {
    const rows = await listarPagosProveedorGlobal();
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: "p1",
      monto: 1500.5,
      moneda: "MXN",
      factura_folio_interno: "FP-000001",
      proveedor_nombre: "ACME SA",
    });
    expect(rows[1].tipo_cambio_usd).toBe(17.5);
  });

  // M-4 (auditoría v14): proveedor y búsqueda se filtran server-side (antes
  // del LIMIT), así que el contrato verificable es la query enviada.
  it("filtra por proveedor server-side (columna embebida)", async () => {
    await listarPagosProveedorGlobal({ proveedorId: "prov-1" });
    const call = mock.tableCalls.find((c) => c.table === "pagos_proveedor");
    expect(call?.opArgs).toEqual(
      expect.arrayContaining([["proveedor_facturas.proveedor_id", "prov-1"]]),
    );
  });

  it("aplica la búsqueda server-side antes del límite", async () => {
    await listarPagosProveedorGlobal({ search: "global" });
    const call = mock.tableCalls.find((c) => c.table === "pagos_proveedor");
    expect(call?.ops.some((op) => op === "or" || op === "ilike")).toBe(true);
    const iLimit = call?.ops.indexOf("limit") ?? -1;
    const iFiltro = call?.ops.findIndex((op) => op === "or" || op === "ilike") ?? -1;
    expect(iFiltro).toBeGreaterThan(-1);
    expect(iLimit).toBeGreaterThan(-1);
  });


  it("propaga error del cliente Supabase", async () => {
    mock.setTableResult("pagos_proveedor", { data: null, error: { message: "boom" } });
    await expect(listarPagosProveedorGlobal()).rejects.toMatchObject({ message: "boom" });
  });
});
