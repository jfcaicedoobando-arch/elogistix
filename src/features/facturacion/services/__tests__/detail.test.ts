import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchFacturaById } from "@/features/facturacion/services/detail";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

const FACTURA = {
  id: "f1",
  numero: "F-001",
  cliente_id: "c1",
  cliente_nombre: "ACME",
  expediente: "EXP-1",
  embarque_id: "e1",
  proforma_id: "p1",
  fecha_emision: "2026-05-01",
  fecha_vencimiento: "2026-06-01",
  subtotal: 1000,
  iva: 160,
  total: 1160,
  moneda: "MXN",
  tipo_cambio: 1,
  estado: "Emitida",
  referencia_bl: null,
  notas: null,
  factura_pdf_url: null,
  factura_xml_url: null,
  snapshot_emision: null,
  organization_id: "org1",
  proformas: { numero: "PRF-001" },
};

describe("fetchFacturaById", () => {
  it("devuelve la factura cuando existe", async () => {
    mock.setTableResult("facturas", { data: FACTURA, error: null });
    // P1-2 (R5): la proforma ya no viene embebida; se resuelve con una 2a query.
    mock.setTableResult("proformas", { data: { numero: "PRF-001" }, error: null });
    const r = await fetchFacturaById("f1");
    expect(r).toEqual({ ...FACTURA, sustituida_por_ref: null });
  });

  it("devuelve null cuando RLS bloquea o la fila no existe", async () => {
    mock.setTableResult("facturas", { data: null, error: null });
    const r = await fetchFacturaById("missing");
    expect(r).toBeNull();
  });

  it("propaga errores de Supabase al consultar factura por ID", async () => {
    mock.setTableResult("facturas", { data: null, error: { message: "boom" } });
    await expect(fetchFacturaById("x")).rejects.toThrow();
  });
});
