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
    ...over,
  };
}

/** N1 (v13.823.386): el saldo programable viene de la vista canónica del
 *  servidor, que convierte pagos y notas de crédito a la moneda de la factura. */
function saldoVista(saldo: number, over: Record<string, unknown> = {}) {
  return {
    data: [
      {
        proveedor_factura_id: "pf-1",
        pagado: 0,
        notas_credito_aplicadas: 1000 - saldo,
        saldo,
        ...over,
      },
    ],
    error: null,
  };
}

describe("fetchPagosProgramables (N1 · saldo canónico del servidor)", () => {
  beforeEach(() => mock.resetResults());

  it("usa el saldo del servidor (factura MXN con nota de crédito en USD)", async () => {
    mock.setTableResult("proveedor_facturas", { data: [fila()], error: null });
    // NC de 20 USD con TC 20 = 400 MXN: el servidor ya entregó el saldo en MXN.
    mock.setTableResult("v_proveedor_facturas_saldo", saldoVista(600));

    const rows = await fetchPagosProgramables();
    expect(rows[0].saldo).toBe(600);
  });

  it("consulta la vista de saldo en lugar de convertir en el navegador", async () => {
    mock.setTableResult("proveedor_facturas", { data: [fila()], error: null });
    mock.setTableResult("v_proveedor_facturas_saldo", saldoVista(1000));

    await fetchPagosProgramables();
    expect(mock.tableCalls.some((c) => c.table === "v_proveedor_facturas_saldo")).toBe(true);
  });

  it("una nota de crédito que cubre el total saca la factura de la bandeja", async () => {
    mock.setTableResult("proveedor_facturas", { data: [fila()], error: null });
    mock.setTableResult("v_proveedor_facturas_saldo", saldoVista(0));

    expect(await fetchPagosProgramables()).toHaveLength(0);
  });
});
