import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";
import { useCreateTrackingLink } from "../useTrackingLinks";

vi.mock("@/services/tracking", () => ({
  createTrackingLink: vi.fn().mockResolvedValue({ id: "link-1", embarque_id: "emb-1" }),
}));

const wrapper = createWrapper();

describe("useTrackingLinks", () => {
  it("useCreateTrackingLink retorna la mutación", () => {
    const { result } = renderHook(() => useCreateTrackingLink(), { wrapper });
    expect(result.current.mutate).toBeDefined();
  });
});
