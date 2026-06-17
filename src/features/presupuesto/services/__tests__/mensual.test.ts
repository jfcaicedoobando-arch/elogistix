import { describe, it, expect, vi, beforeEach } from "vitest";
import { createSupabaseMock } from "@/services/__tests__/_supabaseChainMock";

const { mockRef } = vi.hoisted(() => ({
  mockRef: { current: null as ReturnType<typeof createSupabaseMock> | null },
}));

vi.mock("@/integrations/supabase/client", () => ({
  get supabase() { return mockRef.current!.supabase; },
}));

import { fetchPresupuestoMensualAnio, upsertCeldaPresupuesto } from "../mensual";

describe("presupuesto/mensual", () => {
  beforeEach(() => { mockRef.current = createSupabaseMock(); });

  it("fetchPresupuestoMensualAnio devuelve [] si data null", async () => {
    mockRef.current!.setTableResult("presupuesto_mensual", { data: null, error: null });
    const r = await fetchPresupuestoMensualAnio(2026);
    expect(r).toEqual([]);
  });

  it("fetchPresupuestoMensualAnio propaga error", async () => {
    mockRef.current!.setTableResult("presupuesto_mensual", { data: null, error: new Error("rls") });
    await expect(fetchPresupuestoMensualAnio(2026)).rejects.toThrow("rls");
  });

  it("upsertCeldaPresupuesto no lanza en éxito", async () => {
    mockRef.current!.setTableResult("presupuesto_mensual", { data: null, error: null });
    await expect(
      upsertCeldaPresupuesto({
        categoria_id: "cat-1",
        periodo: "2026-06",
        monto_mxn: 1500,
        organization_id: "org-1",
        creado_por: "user-1",
      }),
    ).resolves.toBeUndefined();
  });

  it("upsertCeldaPresupuesto propaga error", async () => {
    mockRef.current!.setTableResult("presupuesto_mensual", { data: null, error: new Error("dup") });
    await expect(
      upsertCeldaPresupuesto({
        categoria_id: "c", periodo: "2026-06", monto_mxn: 1, organization_id: "o",
      }),
    ).rejects.toThrow("dup");
  });
});
