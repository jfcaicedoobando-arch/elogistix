import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchPortalEmbarques,
  fetchPortalEventos,
  fetchPortalDocumentos,
  fetchPortalCotizaciones,
  fetchPortalFacturas,
  fetchPortalFactura,
  fetchPortalPagosFactura,
} from "@/features/portal/services/queries";

beforeEach(() => {
  mock.tableCalls.length = 0;
});

describe("portal/queries", () => {
  it("fetchPortalEmbarques: corta y retorna [] cuando no hay clienteIds", async () => {
    const r = await fetchPortalEmbarques([]);
    expect(r).toEqual([]);
    expect(mock.tableCalls.length).toBe(0);
  });

  it("fetchPortalEmbarques: consulta tabla embarques cuando hay ids", async () => {
    mock.setTableResult("embarques", { data: [{ id: "e1" }], error: null });
    const r = await fetchPortalEmbarques(["cli-1"]);
    expect(r).toEqual([{ id: "e1" }]);
    expect(mock.tableCalls[0].table).toBe("embarques");
  });

  it("fetchPortalEventos: ordena por fecha desc", async () => {
    mock.setTableResult("eventos_embarque", { data: [], error: null });
    await fetchPortalEventos("emb-1");
    expect(mock.tableCalls[0].ops).toContain("order");
  });

  it("fetchPortalDocumentos: propaga error", async () => {
    mock.setTableResult("documentos_embarque", { data: null, error: new Error("rls") });
    await expect(fetchPortalDocumentos("x")).rejects.toThrow("rls");
  });

  it("fetchPortalCotizaciones: resuelve embarque_expediente desde batch query", async () => {
    mock.setTableResult("cotizaciones", {
      data: [
        { id: "c1", embarque_id: "e1", folio: "COT-1" },
        { id: "c2", embarque_id: null, folio: "COT-2" },
      ],
      error: null,
    });
    mock.setTableResult("embarques", {
      data: [{ id: "e1", expediente: "EXP-X" }],
      error: null,
    });
    const r = await fetchPortalCotizaciones(["cli-1"]);
    expect(r[0].embarque_expediente).toBe("EXP-X");
    expect(r[1].embarque_expediente).toBeNull();
  });

  it("fetchPortalCotizaciones: omite query a embarques cuando no hay vinculados", async () => {
    mock.setTableResult("cotizaciones", {
      data: [{ id: "c1", embarque_id: null, folio: "COT-1" }],
      error: null,
    });
    const r = await fetchPortalCotizaciones(["cli-1"]);
    expect(r[0].embarque_expediente).toBeNull();
    // Solo debería haber consultado cotizaciones, no embarques
    expect(mock.tableCalls.filter((c) => c.table === "embarques").length).toBe(0);
  });

  it("fetchPortalFacturas: ordena por fecha_emision desc", async () => {
    mock.setTableResult("facturas", { data: [{ id: "f1" }], error: null });
    const r = await fetchPortalFacturas(["cli-1"]);
    expect(r).toEqual([{ id: "f1" }]);
    expect(mock.tableCalls[0].ops).toContain("order");
  });

  it("fetchPortalFactura: consulta tabla facturas por id", async () => {
    mock.setTableResult("facturas", { data: { id: "f1" }, error: null });
    const r = await fetchPortalFactura("f1");
    expect(r).toEqual({ id: "f1" });
    expect(mock.tableCalls[0].table).toBe("facturas");
    expect(mock.tableCalls[0].ops).toContain("eq");
  });

  it("fetchPortalFactura: propaga error", async () => {
    mock.setTableResult("facturas", { data: null, error: new Error("rls") });
    await expect(fetchPortalFactura("x")).rejects.toThrow("rls");
  });

  it("fetchPortalPagosFactura: ordena por fecha_pago desc", async () => {
    mock.setTableResult("pagos_factura", { data: [{ id: "p1" }], error: null });
    const r = await fetchPortalPagosFactura("f1");
    expect(r).toEqual([{ id: "p1" }]);
    expect(mock.tableCalls[0].table).toBe("pagos_factura");
    expect(mock.tableCalls[0].ops).toContain("order");
  });

  it("fetchPortalPagosFactura: propaga error", async () => {
    mock.setTableResult("pagos_factura", { data: null, error: new Error("rls") });
    await expect(fetchPortalPagosFactura("f1")).rejects.toThrow("rls");
  });
});
