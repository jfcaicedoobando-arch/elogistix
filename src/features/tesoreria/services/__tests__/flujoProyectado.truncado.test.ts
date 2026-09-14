/**
 * N6 (v13.823.390) — `fetchLiquidacionesPendientes` pedía una sola página con
 * `.limit(CAP_LISTA)` y devolvía el resultado como si fuera el total: con más
 * liquidaciones pendientes que el tope, el flujo proyectado subestimaba los
 * egresos en silencio. Ahora lee TODAS las páginas con `.range`.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
const mock = await vi.hoisted(async () => {
  const { createSupabaseMock } = await import("@/services/__tests__/_supabaseChainMock");
  return createSupabaseMock();
});
vi.mock("@/integrations/supabase/client", () => ({ supabase: mock.supabase }));

import { fetchLiquidacionesPendientes } from "../flujoProyectado";
import { CAP_POSTGREST } from "@/constants/queryCaps";

function filas(n: number, desde = 0) {
  return Array.from({ length: n }, (_, i) => ({
    id: `liq-${desde + i}`,
    vendedora_id: "v1",
    periodo: "2026-09",
    total_mxn: 100,
    fecha_pago: null,
    created_at: "2026-09-01",
  }));
}

describe("fetchLiquidacionesPendientes — sin truncado silencioso", () => {
  beforeEach(() => {
    mock.tableCalls.length = 0;
    mock.resetResults();
  });

  it("lee la segunda página cuando la primera llega completa", async () => {
    mock.setTableResultOnce("liquidaciones_comision", {
      data: filas(CAP_POSTGREST),
      error: null,
    });
    mock.setTableResultOnce("liquidaciones_comision", {
      data: filas(7, CAP_POSTGREST),
      error: null,
    });
    const rows = await fetchLiquidacionesPendientes("org-a");
    expect(rows).toHaveLength(CAP_POSTGREST + 7);
    const llamadas = mock.tableCalls.filter((c) => c.table === "liquidaciones_comision");
    expect(llamadas).toHaveLength(2);
    // Ya no usa `.limit`: pagina con `.range`.
    expect(llamadas[0].ops).toContain("range");
    expect(llamadas[0].ops).not.toContain("limit");
  });

  it("propaga el error en vez de devolver una lista parcial", async () => {
    mock.setTableResult("liquidaciones_comision", {
      data: null,
      error: { message: "permission denied" },
    });
    await expect(fetchLiquidacionesPendientes("org-a")).rejects.toMatchObject({
      message: "permission denied",
    });
  });
});
