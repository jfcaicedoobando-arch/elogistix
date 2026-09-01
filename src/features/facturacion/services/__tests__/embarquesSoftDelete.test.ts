/**
 * Regresión v13.823.22 — Facturación no debe mostrar embarques eliminados
 * (borrado lógico con `deleted_at`). Cubre las tres lecturas del módulo que
 * consultan `embarques`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "@/services/__tests__/_supabaseChainMock";

const { mockRef } = vi.hoisted(() => ({
  mockRef: { current: null as ReturnType<typeof createSupabaseMock> | null },
}));

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() { return mockRef.current!.supabase; },
}));

import { fetchEmbarquesMes } from "@/features/facturacion/services/proyeccion/fetchSources";
import { fetchEmbarquesParaHueco } from "@/features/facturacion/services/huecoFacturacion/fetchSources";
import { fetchReferenciasEmbarque } from "@/features/facturacion/services/referenciasEmbarque";

function isArgsDeEmbarques(): unknown[][] {
  const call = mockRef.current!.tableCalls.find((c) => c.table === "embarques");
  expect(call).toBeDefined();
  return call!.opArgs.filter((_, i) => call!.ops[i] === "is");
}

describe("facturación · embarques con borrado lógico", () => {
  beforeEach(() => { mockRef.current = createSupabaseMock(); });

  it("fetchEmbarquesMes filtra deleted_at IS NULL", async () => {
    mockRef.current!.setTableResult("embarques", { data: [], error: null });
    await fetchEmbarquesMes("org-1", "2026-08-01", "2026-08-31");
    expect(isArgsDeEmbarques()).toContainEqual(["deleted_at", null]);
  });

  it("fetchEmbarquesParaHueco filtra deleted_at IS NULL", async () => {
    mockRef.current!.setTableResult("embarques", { data: [], error: null });
    await fetchEmbarquesParaHueco("org-1", "2026-09-04");
    expect(isArgsDeEmbarques()).toContainEqual(["deleted_at", null]);
  });

  it("fetchReferenciasEmbarque filtra deleted_at IS NULL", async () => {
    mockRef.current!.setTableResult("embarques", { data: null, error: null });
    const res = await fetchReferenciasEmbarque("11111111-1111-4111-8111-111111111111");
    expect(res).toBeNull();
    expect(isArgsDeEmbarques()).toContainEqual(["deleted_at", null]);
  });
});
