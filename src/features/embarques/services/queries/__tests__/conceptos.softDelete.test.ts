/**
 * Regresión: las lecturas de conceptos deben excluir borrados lógicos.
 *
 * `actualizar_embarque_completo` marca `deleted_at` en los conceptos pendientes
 * que el usuario quitó. Sin `.is("deleted_at", null)` el detalle del embarque
 * volvía a mostrarlos y el usuario reportaba "guardé y no se grabó".
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

describe("conceptos del embarque · borrado lógico", () => {
  it("fetchEmbarqueConceptosVenta filtra deleted_at IS NULL", async () => {
    mock.setTableResult("conceptos_venta", { data: [], error: null });
    await fetchEmbarqueConceptosVenta(EMBARQUE_ID);
    const call = mock.tableCalls.find((c) => c.table === "conceptos_venta");
    expect(call?.ops).toEqual(expect.arrayContaining(["select", "eq", "is"]));
  });

  it("fetchEmbarqueConceptosCosto filtra deleted_at IS NULL", async () => {
    mock.setTableResult("conceptos_costo", { data: [], error: null });
    await fetchEmbarqueConceptosCosto(EMBARQUE_ID);
    const call = mock.tableCalls.find((c) => c.table === "conceptos_costo");
    expect(call?.ops).toEqual(expect.arrayContaining(["select", "eq", "is"]));
  });
});
