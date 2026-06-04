import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { useOrganizationsList } from "../useOrganizationsList";
import { createWrapper } from "@/test/utils/queryWrapper";

vi.mock("@/services/admin", () => ({
  fetchOrganizationsList: vi.fn().mockResolvedValue([{ id: "1", nombre: "Org A" }]),
}));

describe("useOrganizationsList", () => {
  it("fetches list of organizations", async () => {
    const { result } = renderHook(() => useOrganizationsList(), { wrapper: createWrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it("can be disabled", () => {
    const { result } = renderHook(() => useOrganizationsList(false), { wrapper: createWrapper() });
    expect(result.current.isEnabled).toBe(false);
  });
});
