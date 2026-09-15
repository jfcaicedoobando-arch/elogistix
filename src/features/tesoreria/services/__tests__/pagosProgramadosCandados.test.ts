/**
 * MNY-05 / MNY-06 — la bandeja ejecutable no debe incluir facturas rechazadas
 * ni facturas cuyo saldo no confirmó el servidor (fail-closed).
 */
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

function saldoVista(id: string, saldo: number) {
  return {
    data: [{ proveedor_factura_id: id, pagado: 0, notas_credito_aplicadas: 0, saldo }],
    error: null,
  };
}

describe("fetchPagosProgramables · candados MNY-05/MNY-06", () => {
  beforeEach(() => mock.resetResults());

  it("excluye las facturas rechazadas", async () => {
    mock.setTableResult("proveedor_facturas", {
      data: [fila(), fila({ id: "pf-2", estado_aprobacion: "rechazada" })],
      error: null,
    });
    mock.setTableResult("v_proveedor_facturas_saldo", {
      data: [
        { proveedor_factura_id: "pf-1", pagado: 0, notas_credito_aplicadas: 0, saldo: 1000 },
        { proveedor_factura_id: "pf-2", pagado: 0, notas_credito_aplicadas: 0, saldo: 1000 },
      ],
      error: null,
    });

    const rows = await fetchPagosProgramables();
    expect(rows.map((r) => r.id)).toEqual(["pf-1"]);
  });

  it("excluye la factura si el servidor no confirmó su saldo", async () => {
    mock.setTableResult("proveedor_facturas", {
      data: [fila(), fila({ id: "pf-2" })],
      error: null,
    });
    mock.setTableResult("v_proveedor_facturas_saldo", saldoVista("pf-1", 400));

    const rows = await fetchPagosProgramables();
    expect(rows).toHaveLength(1);
    expect(rows[0].saldo).toBe(400);
  });
});
