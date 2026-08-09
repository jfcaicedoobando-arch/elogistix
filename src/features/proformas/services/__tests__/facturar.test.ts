import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { marcarProformaFacturada } from "@/features/proformas/services/facturar";

function proformaRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "prof-1",
    organization_id: "org-1",
    embarque_id: "emb-1",
    cliente_id: "cli-1",
    cliente_nombre: "ACME",
    expediente: "EXP-1",
    dias_credito: 15,
    subtotal_usd: 100, iva_usd: 16, total_usd: 116,
    subtotal_mxn: 200, iva_mxn: 32, total_mxn: 232,
    ...overrides,
  };
}

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("marcarProformaFacturada", () => {
  it("calcula fecha_vencimiento = fechaFacturacion + dias_credito (UTC-safe)", async () => {
    mock.setTableResult("proformas", { data: proformaRow({ dias_credito: 30 }), error: null });
    mock.setTableResult("facturas", { data: [{ id: "f1" }], error: null });
    await marcarProformaFacturada({
      proformaId: "prof-1",
      folioFacturaExterna: "A-100",
      fechaFacturacion: "2026-01-31",
    });
    // 2026-01-31 + 30 días = 2026-03-02 (UTC, addDays sin DST).
    const payload = mock.getMutationPayload("facturas", "insert") as
      | Record<string, unknown>
      | Array<Record<string, unknown>>
      | null;
    expect(payload).toBeTruthy();
    const first = Array.isArray(payload) ? payload[0] : payload!;
    expect(first.fecha_emision).toBe("2026-01-31");
    expect(first.fecha_vencimiento).toBe("2026-03-02");
    expect(first.numero).toBe("A-100");
  });

  it("crea factura USD y MXN cuando ambos totales > 0", async () => {
    mock.setTableResult("proformas", { data: proformaRow(), error: null });
    mock.setTableResult("facturas", { data: [{ id: "f-usd" }, { id: "f-mxn" }], error: null });
    await marcarProformaFacturada({
      proformaId: "prof-1",
      folioFacturaExterna: "F-1",
      fechaFacturacion: "2026-05-01",
    });
    expect(mock.tableCalls.some((c) => c.table === "facturas" && c.ops.includes("insert"))).toBe(true);
    expect(mock.tableCalls.some((c) => c.table === "proformas" && c.ops.includes("update"))).toBe(true);
  });

  // A5 (v13.469.0): antes quedaba "facturada" con factura_id NULL y la venta
  // nunca entraba a cartera. Ahora se rechaza de tajo.
  it("rechaza marcar facturada si ambos totales son 0 y no toca nada", async () => {
    mock.setTableResult("proformas", {
      data: proformaRow({ total_usd: 0, total_mxn: 0 }),
      error: null,
    });
    await expect(
      marcarProformaFacturada({
        proformaId: "prof-1",
        folioFacturaExterna: "F-0",
        fechaFacturacion: "2026-05-01",
      }),
    ).rejects.toThrow("LC_PROFORMA_TOTAL_CERO");
    const insertedFacturas = mock.tableCalls.filter(
      (c) => c.table === "facturas" && c.ops.includes("insert"),
    );
    expect(insertedFacturas.length).toBe(0);
    expect(mock.tableCalls.some((c) => c.table === "proformas" && c.ops.includes("update"))).toBe(false);
  });

  it("propaga error al leer la proforma", async () => {
    mock.setTableResult("proformas", { data: null, error: new Error("not found") });
    await expect(
      marcarProformaFacturada({
        proformaId: "x", folioFacturaExterna: "F", fechaFacturacion: "2026-05-01",
      }),
    ).rejects.toThrow("not found");
  });
});
