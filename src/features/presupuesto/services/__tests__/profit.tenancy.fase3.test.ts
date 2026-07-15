/**
 * Fase 3 — regresión multi-tenant en el módulo Profit.
 *
 * Verifica que los servicios que antes cruzaban organizaciones por RLS
 * ahora filtran explícitamente por `organization_id` cuando se les
 * proporciona.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchCategorias } from "@/features/presupuesto/services/categorias";
import { fetchPresupuestoMensualAnio } from "@/features/presupuesto/services/mensual";
import { fetchFacturasPorExpedientes } from "@/features/facturacion/services/shared/fetchFacturas";

function eqCalls(table: string) {
  const call = mock.tableCalls.find((c) => c.table === table);
  if (!call) return [] as Array<[string, unknown]>;
  return call.ops
    .map((op, i) => ({ op, args: call.opArgs[i] as [string, unknown] }))
    .filter((p) => p.op === "eq")
    .map((p) => p.args);
}

describe("Fase 3 — filtro organization_id en servicios Profit", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.setTableResult("presupuesto_categorias", { data: [], error: null });
    mock.setTableResult("presupuesto_mensual", { data: [], error: null });
    mock.setTableResult("facturas", { data: [], error: null });
  });

  it("fetchCategorias filtra por organization_id cuando se provee", async () => {
    await fetchCategorias(true, "org-9");
    const eqs = eqCalls("presupuesto_categorias");
    expect(eqs.some(([col, val]) => col === "organization_id" && val === "org-9")).toBe(true);
  });

  it("fetchCategorias NO agrega filtro cuando orgId es null/undefined", async () => {
    await fetchCategorias(true);
    const eqs = eqCalls("presupuesto_categorias");
    expect(eqs.some(([col]) => col === "organization_id")).toBe(false);
  });

  it("fetchPresupuestoMensualAnio filtra por organization_id", async () => {
    await fetchPresupuestoMensualAnio(2026, "org-9");
    const eqs = eqCalls("presupuesto_mensual");
    expect(eqs.some(([col, val]) => col === "organization_id" && val === "org-9")).toBe(true);
  });

  it("fetchFacturasPorExpedientes filtra por organization_id", async () => {
    await fetchFacturasPorExpedientes(["EXP-1"], "org-9");
    const eqs = eqCalls("facturas");
    expect(eqs.some(([col, val]) => col === "organization_id" && val === "org-9")).toBe(true);
  });

  it("fetchFacturasPorExpedientes con expedientes vacíos no consulta BD", async () => {
    const r = await fetchFacturasPorExpedientes([], "org-9");
    expect(r).toEqual([]);
    expect(mock.tableCalls.find((c) => c.table === "facturas")).toBeUndefined();
  });
});
