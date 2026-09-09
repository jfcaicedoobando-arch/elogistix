import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

// Ola 5 · A22: el servicio consulta el TC DOF como respaldo de filas sin embarque.
vi.mock("@/features/catalogos/services", () => ({
  fetchExchangeRates: vi.fn(async () => ({ usdMxn: 18, eurMxn: 21, esFallback: false })),
  EXCHANGE_RATES_FALLBACK: { usdMxn: 17.25, eurMxn: 18.5, esFallback: true },
}));

vi.mock("@/features/profit/domain/estadoResultados", () => ({
  buildEstadoResultados: vi.fn((emb, v, c) => ({ emb, v, c }))
}));

import { fetchEstadoResultadosDevengado } from "../estadoResultadosDevengado";

describe("estadoResultadosDevengado service", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.rpcCalls.length = 0;
  });

  it("fetchEstadoResultadosDevengado consulta facturas, ncs y proveedor_facturas", async () => {
    mock.setTableResult("facturas", { data: [], error: null });
    mock.setTableResult("factura_notas_credito", { data: [], error: null });
    mock.setTableResult("proveedor_facturas", { data: [], error: null });
    
    await fetchEstadoResultadosDevengado({ organizationId: "o1", year: 2024, month: 1 });
    
    expect(mock.tableCalls.some(c => c.table === "facturas")).toBe(true);
    expect(mock.tableCalls.some(c => c.table === "factura_notas_credito")).toBe(true);
    expect(mock.tableCalls.some(c => c.table === "proveedor_facturas")).toBe(true);
  });

  it("resuelve embarques por expediente y por id", async () => {
    mock.setTableResult("facturas", { data: [{ id: "f1", expediente: "EXP1" }], error: null });
    mock.setTableResult("factura_notas_credito", { data: [], error: null });
    mock.setTableResult("proveedor_facturas", { data: [{ id: "pf1", embarque_id: "e1" }], error: null });
    mock.setTableResult("embarques", { data: [], error: null }); // para las 2 llamadas internas
    
    await fetchEstadoResultadosDevengado({ organizationId: "o1", year: 2024, month: 1 });
    const embCalls = mock.tableCalls.filter(c => c.table === "embarques");
    expect(embCalls.length).toBe(2);
  });

  it("cubre fallbacks de embarque no encontrado, tipo cambio null/0 y notas de crédito", async () => {
    // f1: sin expediente -> fallback Marítimo, tc=1 (porque tipo_cambio=0)
    // f2: con expediente pero embarque no encontrado -> fallback, tc=20
    mock.setTableResult("facturas", { 
      data: [
        { id: "f1", expediente: null, total: 1000, moneda: "USD", tipo_cambio: 0 },
        { id: "f2", expediente: "EXP-MISSING", total: 200, moneda: "USD", tipo_cambio: 20 }
      ], 
      error: null 
    });
    // nc1: nota de crédito -> bucket ventas, modo Marítimo, tc=1
    mock.setTableResult("factura_notas_credito", { 
      data: [{ factura_id: "f1", monto: 100, moneda: "USD", updated_at: "2024-01-05" }], 
      error: null 
    });
    // pf1: sin embarque_id -> fallback Marítimo, tc=1 (porque tipo_cambio_usd=null)
    mock.setTableResult("proveedor_facturas", { 
      data: [{ id: "pf1", embarque_id: null, total: 500, moneda: "USD", tipo_cambio_usd: null }], 
      error: null 
    });
    
    mock.setTableResult("embarques", { data: [], error: null });
    
    const res: any = await fetchEstadoResultadosDevengado({ organizationId: null, year: 2024, month: 1 });
    
    expect(res.emb.length).toBe(4);
    // EERR-MODO: sin embarque vinculado el importe cae en "Otros", no en Marítimo.
    expect(res.emb.every((e: any) => e.modo === "Otros")).toBe(true);
    // Sin TC propio → respaldo DOF (18), nunca 1.
    expect(res.emb[0].tipo_cambio_usd).toBe(18);
    expect(res.emb[1].tipo_cambio_usd).toBe(20);
  });

  it("Ola 5 · A22: usa el TC EUR del DOF como respaldo (no 1) en filas sin embarque", async () => {
    mock.setTableResult("facturas", {
      data: [{ id: "f1", expediente: null, total: 1000, moneda: "EUR", tipo_cambio: null }],
      error: null,
    });
    mock.setTableResult("factura_notas_credito", {
      data: [{ factura_id: "f1", monto: 100, moneda: "EUR", updated_at: "2024-01-05" }],
      error: null,
    });
    mock.setTableResult("proveedor_facturas", {
      data: [{ id: "pf1", embarque_id: null, total: 500, moneda: "EUR", tipo_cambio_usd: null }],
      error: null,
    });
    mock.setTableResult("embarques", { data: [], error: null });

    const res: any = await fetchEstadoResultadosDevengado({ organizationId: null, year: 2024, month: 1 });

    expect(res.emb.every((e: any) => e.tipo_cambio_eur === 21)).toBe(true);
    expect(res.emb.some((e: any) => e.tipo_cambio_eur === 1)).toBe(false);
  });

  it("BL-06: ingresos y costos devengados usan subtotal (sin IVA), no total", async () => {
    mock.setTableResult("facturas", {
      data: [{ id: "f1", expediente: null, subtotal: 1000, total: 1160, moneda: "MXN", fecha_emision: "2024-01-10", tipo_cambio: 1 }],
      error: null,
    });
    mock.setTableResult("factura_notas_credito", { data: [], error: null });
    mock.setTableResult("proveedor_facturas", {
      data: [{ id: "pf1", embarque_id: null, subtotal: 500, total: 580, moneda: "MXN", fecha_emision: "2024-01-10", tipo_cambio_usd: null }],
      error: null,
    });
    mock.setTableResult("embarques", { data: [], error: null });

    const res: any = await fetchEstadoResultadosDevengado({ organizationId: null, year: 2024, month: 1 });

    expect(res.v[0].total).toBe(1000);
    expect(res.c[0].monto).toBe(500);
  });

  it("BL-10: las NCs se filtran por fecha_emision (no updated_at)", async () => {
    mock.setTableResult("facturas", { data: [], error: null });
    mock.setTableResult("factura_notas_credito", { data: [], error: null });
    mock.setTableResult("proveedor_facturas", { data: [], error: null });

    await fetchEstadoResultadosDevengado({ organizationId: null, year: 2024, month: 1 });

    const ncCall = mock.tableCalls.find((c) => c.table === "factura_notas_credito");
    const gteIdx = ncCall?.ops.indexOf("gte") ?? -1;
    const lteIdx = ncCall?.ops.indexOf("lte") ?? -1;
    expect(gteIdx).toBeGreaterThanOrEqual(0);
    expect((ncCall!.opArgs[gteIdx] as [string, string])[0]).toBe("fecha_emision");
    expect((ncCall!.opArgs[lteIdx] as [string, string])[0]).toBe("fecha_emision");
  });

  it("EERR-TC: el TC de la factura manda sobre el TC del embarque", async () => {
    mock.setTableResult("facturas", {
      data: [{ id: "f1", expediente: "EXP1", subtotal: 100, moneda: "USD", fecha_emision: "2024-01-10", tipo_cambio: 19 }],
      error: null,
    });
    mock.setTableResult("factura_notas_credito", { data: [], error: null });
    mock.setTableResult("proveedor_facturas", { data: [], error: null });
    mock.setTableResult("proveedor_notas_credito", { data: [], error: null });
    mock.setTableResult("embarques", {
      data: [{ id: "e1", modo: "Aéreo", tipo_cambio_usd: 15, tipo_cambio_eur: 20, expediente: "EXP1" }],
      error: null,
    });

    const res: any = await fetchEstadoResultadosDevengado({ organizationId: "o1", year: 2024, month: 1 });

    expect(res.emb[0].tipo_cambio_usd).toBe(19);
    expect(res.emb[0].modo).toBe("Aéreo");
  });

  it("EERR-DUP: expediente duplicado no asigna embarque (modo Otros)", async () => {
    mock.setTableResult("facturas", {
      data: [{ id: "f1", expediente: "EXP1", subtotal: 100, moneda: "MXN", fecha_emision: "2024-01-10", tipo_cambio: 1 }],
      error: null,
    });
    mock.setTableResult("factura_notas_credito", { data: [], error: null });
    mock.setTableResult("proveedor_facturas", { data: [], error: null });
    mock.setTableResult("proveedor_notas_credito", { data: [], error: null });
    mock.setTableResult("embarques", {
      data: [
        { id: "e1", modo: "Aéreo", tipo_cambio_usd: 18, tipo_cambio_eur: 20, expediente: "EXP1" },
        { id: "e2", modo: "Marítimo", tipo_cambio_usd: 18, tipo_cambio_eur: 20, expediente: "EXP1" },
      ],
      error: null,
    });

    const res: any = await fetchEstadoResultadosDevengado({ organizationId: "o1", year: 2024, month: 1 });

    expect(res.emb[0].modo).toBe("Otros");
  });

  it("EERR-NCP: resta las notas de crédito de proveedor aplicadas del mes", async () => {
    mock.setTableResult("facturas", { data: [], error: null });
    mock.setTableResult("factura_notas_credito", { data: [], error: null });
    mock.setTableResult("proveedor_facturas", {
      data: [{ id: "pf1", embarque_id: null, subtotal: 500, moneda: "MXN", fecha_emision: "2024-01-10", tipo_cambio_usd: null }],
      error: null,
    });
    mock.setTableResult("proveedor_notas_credito", {
      data: [{ id: "n1", proveedor_factura_id: "pf1", monto: 120, moneda: "MXN", fecha: "2024-01-20", tipo_cambio: 1 }],
      error: null,
    });
    mock.setTableResult("embarques", { data: [], error: null });

    const res: any = await fetchEstadoResultadosDevengado({ organizationId: "o1", year: 2024, month: 1 });

    expect(res.c).toHaveLength(2);
    expect(res.c[1].monto).toBe(-120);
  });

  it("EERR-APROB: excluye facturas de proveedor rechazadas", async () => {
    mock.setTableResult("facturas", { data: [], error: null });
    mock.setTableResult("factura_notas_credito", { data: [], error: null });
    mock.setTableResult("proveedor_facturas", { data: [], error: null });
    mock.setTableResult("proveedor_notas_credito", { data: [], error: null });

    await fetchEstadoResultadosDevengado({ organizationId: "o1", year: 2024, month: 1 });

    const call = mock.tableCalls.find((c) => c.table === "proveedor_facturas");
    const neqArgs = call!.ops
      .map((op, i) => [op, call!.opArgs[i]] as const)
      .filter(([op]) => op === "neq")
      .map(([, args]) => args as [string, string]);
    expect(neqArgs).toEqual(
      expect.arrayContaining([["estado", "Cancelada"], ["estado_aprobacion", "rechazada"]]),
    );
  });

  it("maneja errores de supabase", async () => {
    mock.setTableResult("facturas", { data: null, error: { message: "db-fail" } });
    await expect(fetchEstadoResultadosDevengado({ organizationId: null, year: 2024, month: 1 })).rejects.toThrow("db-fail");
  });

  it("filtra facturas por estados vivos: Cancelada y Sustituida quedan fuera", async () => {
    mock.setTableResult("facturas", { data: [], error: null });
    mock.setTableResult("factura_notas_credito", { data: [], error: null });
    mock.setTableResult("proveedor_facturas", { data: [], error: null });

    await fetchEstadoResultadosDevengado({ organizationId: "o1", year: 2024, month: 1 });

    const facturasCall = mock.tableCalls.find((c) => c.table === "facturas");
    const inIdx = facturasCall?.ops.indexOf("in") ?? -1;
    expect(inIdx).toBeGreaterThanOrEqual(0);
    const [column, values] = facturasCall!.opArgs[inIdx] as [string, string[]];
    expect(column).toBe("estado");
    expect(values).toEqual(expect.arrayContaining(["Emitida", "Pagada", "Parcialmente pagada", "Vencida"]));
    expect(values).not.toContain("Cancelada");
    expect(values).not.toContain("Sustituida");
  });
});
