/**
 * Tests for src/services/embarque/queries/conceptos.ts
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import {
  fetchEmbarqueConceptosVenta,
  fetchEmbarqueConceptosCosto,
} from "@/features/embarques/services/queries/conceptos";

const EMBARQUE_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

beforeEach(() => {
  mock.tableCalls.length = 0;
  mock.rpcCalls.length = 0;
});

describe("fetchEmbarqueConceptosVenta", () => {
  it("queries conceptos_venta filtered by embarque_id", async () => {
    mock.setTableResult("conceptos_venta", { data: [], error: null });
    const result = await fetchEmbarqueConceptosVenta(EMBARQUE_ID);
    expect(result).toEqual([]);
    const call = mock.tableCalls.find((c) => c.table === "conceptos_venta");
    expect(call?.ops).toEqual(expect.arrayContaining(["select", "eq"]));
  });

  it("returns rows from supabase", async () => {
    const row = { id: "r1", embarque_id: EMBARQUE_ID, descripcion: "Flete", total: 1000 };
    mock.setTableResult("conceptos_venta", { data: [row], error: null });
    const result = await fetchEmbarqueConceptosVenta(EMBARQUE_ID);
    expect(result).toHaveLength(1);
    expect(result[0]?.descripcion).toBe("Flete");
  });

  it("throws when fetchEmbarqueConceptosVenta supabase errors", async () => {
    mock.setTableResult("conceptos_venta", { data: null, error: new Error("rls") });
    await expect(fetchEmbarqueConceptosVenta(EMBARQUE_ID)).rejects.toThrow("rls");
  });
});

describe("fetchEmbarqueConceptosCosto", () => {
  it("queries conceptos_costo filtered by embarque_id", async () => {
    mock.setTableResult("conceptos_costo", { data: [], error: null });
    const result = await fetchEmbarqueConceptosCosto(EMBARQUE_ID);
    expect(result).toEqual([]);
    const call = mock.tableCalls.find((c) => c.table === "conceptos_costo");
    expect(call?.ops).toEqual(expect.arrayContaining(["select", "eq"]));
  });

  it("returns rows from supabase", async () => {
    const row = { id: "c1", embarque_id: EMBARQUE_ID, concepto: "Almacenaje", monto: 500 };
    mock.setTableResult("conceptos_costo", { data: [row], error: null });
    const result = await fetchEmbarqueConceptosCosto(EMBARQUE_ID);
    expect(result).toHaveLength(1);
    expect(result[0]?.concepto).toBe("Almacenaje");
  });

  it("throws when fetchEmbarqueConceptosCosto supabase errors", async () => {
    mock.setTableResult("conceptos_costo", { data: null, error: new Error("db err") });
    await expect(fetchEmbarqueConceptosCosto(EMBARQUE_ID)).rejects.toThrow("db err");
  });
});
