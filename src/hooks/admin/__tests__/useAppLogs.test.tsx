import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useAppLogs } from "../useAppLogs";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("@/services/admin", () => ({
  fetchAppLogs: vi.fn().mockResolvedValue({ rows: [{ id: "1", level: "info" }], total: 1 }),
}));

describe("useAppLogs", () => {
  it("fetches logs with pagination and filters", async () => {
    const args = { page: 1, pageSize: 10, level: "info" as const, fn: "todos", search: "", from: null, to: null };
    const { result } = renderHook(() => useAppLogs(args), { wrapper: createWrapper() });
    
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.totalPages).toBe(1);
  });

  it("handles empty data", async () => {
    const args = { page: 1, pageSize: 10, level: "info" as const, fn: "todos", search: "nonexistent", from: null, to: null };
    const { result } = renderHook(() => useAppLogs(args), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.total).toBe(1); // from mock
  });
});
