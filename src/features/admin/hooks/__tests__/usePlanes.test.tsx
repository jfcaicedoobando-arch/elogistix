import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { usePlanes, useUpdatePlan } from "../usePlanes";
import { createWrapper } from "@/test/utils/queryWrapper";
import * as planesService from "@/features/admin/services/planes";

vi.mock("@/features/admin/services/planes", () => ({
  fetchPlanes: vi.fn().mockResolvedValue([{ id: "1", nombre: "Plan A" }]),
  updatePlan: vi.fn().mockResolvedValue({ success: true }),
}));

vi.mock("@/hooks/shared", () => ({
  useToast: vi.fn(() => ({ toast: vi.fn() })),
}));

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

describe("usePlanes", () => {
  it("fetches planes", async () => {
    const { result } = renderHook(() => usePlanes(), { wrapper: createWrapper() });
    
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveLength(1);
  });

  it("updates a plan", async () => {
    const { result } = renderHook(() => useUpdatePlan(), { wrapper: createWrapper() });
    
    await result.current.mutateAsync({ id: "1", nombre: "Updated Plan" } as any);
    
    expect(planesService.updatePlan).toHaveBeenCalled();
  });
});
