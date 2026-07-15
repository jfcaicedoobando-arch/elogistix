import { describe, it, expect, vi } from "vitest";
import { invalidateProfitDependencies } from "../invalidateProfitDependencies";
import { queryKeys } from "@/lib/query";

describe("invalidateProfitDependencies", () => {
  it("invalida las tres claves raíz de Profit", () => {
    const invalidateQueries = vi.fn();
    const qc = { invalidateQueries } as unknown as import("@tanstack/react-query").QueryClient;

    invalidateProfitDependencies(qc);

    expect(invalidateQueries).toHaveBeenCalledTimes(3);
    const keys = invalidateQueries.mock.calls.map((c) => c[0].queryKey);
    expect(keys).toContainEqual(queryKeys.dashboardEjecutivo.all);
    expect(keys).toContainEqual(queryKeys.presupuesto.all);
    expect(keys).toContainEqual(queryKeys.profit.all);
  });
});
