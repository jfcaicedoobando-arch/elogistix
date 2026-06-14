import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useAppLogsHealthSummary, computeKpis } from "../useAppLogsHealth";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("@/services/admin", () => ({
  fetchAppLogsHealthSummary: vi.fn().mockResolvedValue([
    { function_name: "test", total: 10, errors: 2, warns: 1 }
  ]),
}));

describe("useAppLogsHealth", () => {
  it("fetches health summary", async () => {
    const { result } = renderHook(() => useAppLogsHealthSummary(24), { wrapper: createWrapper() });
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it("computes KPIs correctly", () => {
    const rows = [
      { function_name: "fn1", total: 100, errors: 10, warns: 5 },
      { function_name: "fn2", total: 50, errors: 5, warns: 2 },
    ];
    const kpis = computeKpis(rows as any);
    
    expect(kpis.totalEvents).toBe(150);
    expect(kpis.totalErrors).toBe(15);
    expect(kpis.errorRatePct).toBe(10);
    expect(kpis.affectedFns).toBe(2);
  });
});
