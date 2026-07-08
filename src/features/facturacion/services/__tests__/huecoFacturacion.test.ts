import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchHuecoFacturacion } from "@/features/facturacion/services/huecoFacturacion";

const HOY = new Date("2026-06-15T12:00:00Z");

function emb(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id, expediente: `EXP-${id}`, cliente_nombre: "ACME", operador: "Op",
    etd: "2026-06-01", eta: "2026-06-20", bl_master: "BLM", bl_house: "BLH",
    tipo_cambio_usd: 20, tipo_cambio_eur: 22,
    ...overrides,
  };
}

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("fetchHuecoFacturacion", () => {
  it("devuelve resultado vacío cuando no hay embarques que superen el umbral", async () => {
    mock.setTableResult("embarques", { data: [], error: null });
    const r = await fetchHuecoFacturacion({ organizationId: "org-1", hoy: HOY });
    expect(r).toEqual({ filas: [], totalEmbarques: 0, totalUsd: 0, totalMxn: 0 });
  });

  it("excluye embarques con factura asociada al expediente", async () => {
    mock.setTableResult("embarques", { data: [emb("a"), emb("b")], error: null });
    mock.setTableResult("conceptos_venta", {
      data: [
        { embarque_id: "a", total: 100, moneda: "USD" },
        { embarque_id: "b", total: 200, moneda: "MXN" },
      ],
      error: null,
    });
    mock.setTableResult("facturas", {
      data: [{ expediente: "EXP-a", factura_pdf_url: "x.pdf" }],
      error: null,
    });
    const r = await fetchHuecoFacturacion({ organizationId: "org-1", hoy: HOY });
    expect(r.totalEmbarques).toBe(1);
    expect(r.filas[0].expediente).toBe("EXP-b");
  });

  it("calcula totales en USD/MXN sumando conceptos del embarque", async () => {
    mock.setTableResult("embarques", { data: [emb("a")], error: null });
    mock.setTableResult("conceptos_venta", {
      data: [
        { embarque_id: "a", total: 10, moneda: "USD" },
        { embarque_id: "a", total: 100, moneda: "MXN" },
      ],
      error: null,
    });
    mock.setTableResult("facturas", { data: [], error: null });
    const r = await fetchHuecoFacturacion({ organizationId: "org-1", hoy: HOY });
    expect(r.totalEmbarques).toBe(1);
    expect(r.totalMxn).toBeCloseTo(10 * 20 + 100, 2); // USD→MXN + MXN
    expect(r.totalUsd).toBeCloseTo(10 + 100 / 20, 2);
  });

  it("ordena filas por diasDesdeEta descendente", async () => {
    mock.setTableResult("embarques", {
      data: [emb("nuevo", { eta: "2026-06-10" }), emb("viejo", { eta: "2026-05-01" })],
      error: null,
    });
    mock.setTableResult("conceptos_venta", { data: [], error: null });
    mock.setTableResult("facturas", { data: [], error: null });
    const r = await fetchHuecoFacturacion({ organizationId: null, hoy: HOY });
    expect(r.filas.map((f) => f.embarque_id)).toEqual(["viejo", "nuevo"]);
  });

  it("v13.217.0 — el límite superior de ETA es hoy + 3 días", async () => {
    mock.setTableResult("embarques", { data: [], error: null });
    mock.setTableResult("conceptos_venta", { data: [], error: null });
    mock.setTableResult("facturas", { data: [], error: null });
    await fetchHuecoFacturacion({ organizationId: "org-1", hoy: HOY });
    const embarquesCall = mock.tableCalls.find((c) => c.table === "embarques");
    expect(embarquesCall).toBeDefined();
    const lteIdx = embarquesCall!.ops.indexOf("lte");
    expect(lteIdx).toBeGreaterThanOrEqual(0);
    // HOY = 2026-06-15 → límite = 2026-06-18
    expect(embarquesCall!.opArgs[lteIdx]).toEqual(["eta", "2026-06-18"]);
  });
});

