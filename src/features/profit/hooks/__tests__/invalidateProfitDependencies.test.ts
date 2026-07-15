/**
 * Contrato: `invalidateProfitDependencies` DEBE invalidar los 3 dominios
 * financieros del módulo Profit — Dashboard Ejecutivo, Presupuesto y EERR/Profit.
 *
 * Si alguien añade/renombra un `queryKeys.profit`, este test falla y obliga a
 * revisar el helper. Evita el escenario silencioso en que las mutaciones dejan
 * de refrescar los dashboards.
 */
import { describe, it, expect, vi } from "vitest";
import type { QueryClient } from "@tanstack/react-query";
import { invalidateProfitDependencies } from "../invalidateProfitDependencies";
import { queryKeys } from "@/lib/query";

describe("invalidateProfitDependencies", () => {
  it("invalida los 3 dominios Profit (dashboardEjecutivo, presupuesto, profit)", () => {
    const invalidateQueries = vi.fn();
    const qc = { invalidateQueries } as unknown as QueryClient;

    invalidateProfitDependencies(qc);

    expect(invalidateQueries).toHaveBeenCalledTimes(3);
    const keys = invalidateQueries.mock.calls.map((c) => (c[0] as { queryKey: readonly unknown[] }).queryKey);
    expect(keys).toContainEqual(queryKeys.dashboardEjecutivo.all);
    expect(keys).toContainEqual(queryKeys.presupuesto.all);
    // Prefix ["profit"] — matching parcial de React Query alcanza queryKeys.profit.estadoResultados(...)
    expect(keys).toContainEqual(["profit"]);
  });
});
