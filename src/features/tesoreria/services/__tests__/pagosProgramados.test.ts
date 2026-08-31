import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchPagosProgramables } from "../pagosProgramados";

function fila(over: Record<string, unknown> = {}) {
  return {
    id: "pf-1",
    proveedor_nombre: "Naviera SA",
    folio_proveedor: "A-1",
    fecha_vencimiento: "2026-09-01",
    fecha_programada_pago: null,
    moneda: "MXN",
    total: 1000,
    estado: "Vigente",
    estado_aprobacion: "aprobada",
    pagos_proveedor: [],
    proveedor_notas_credito: [],
    ...over,
  };
}

describe("fetchPagosProgramables (A-2 · notas de crédito)", () => {
  beforeEach(() => mock.resetResults());

  it("resta las notas de crédito aplicadas del saldo programable", async () => {
    mock.setTableResult("proveedor_facturas", {
      data: [
        fila({
          proveedor_notas_credito: [{ monto: 400, estado: "Aplicada", deleted_at: null }],
        }),
      ],
      error: null,
    });

    const rows = await fetchPagosProgramables();
    expect(rows[0].saldo).toBe(600);
  });

  it("ignora notas de crédito no aplicadas o eliminadas", async () => {
    mock.setTableResult("proveedor_facturas", {
      data: [
        fila({
          proveedor_notas_credito: [
            { monto: 400, estado: "Borrador", deleted_at: null },
            { monto: 300, estado: "Aplicada", deleted_at: "2026-08-01" },
          ],
        }),
      ],
      error: null,
    });

    const rows = await fetchPagosProgramables();
    expect(rows[0].saldo).toBe(1000);
  });

  it("una NC que cubre el total saca la factura de la bandeja", async () => {
    mock.setTableResult("proveedor_facturas", {
      data: [
        fila({
          proveedor_notas_credito: [{ monto: 1000, estado: "Aplicada", deleted_at: null }],
        }),
      ],
      error: null,
    });

    expect(await fetchPagosProgramables()).toHaveLength(0);
  });
});
