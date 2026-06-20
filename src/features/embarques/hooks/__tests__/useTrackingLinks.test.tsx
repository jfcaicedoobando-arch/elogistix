import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { createWrapper } from "@/test/utils/queryWrapper";

const createTrackingLinkMock = vi.fn().mockResolvedValue({ id: "link-1", embarque_id: "emb-1" });

vi.mock("@/features/embarques/services/tracking", () => ({
  createTrackingLink: (...args: unknown[]) => createTrackingLinkMock(...args),
}));

import { useCreateTrackingLink } from "../useTrackingLinks";

describe("useTrackingLinks", () => {
  it("useCreateTrackingLink invoca createTrackingLink y resuelve con el link creado", async () => {
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateTrackingLink(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ embarqueId: "emb-1" });
    });

    expect(createTrackingLinkMock).toHaveBeenCalledTimes(1);
    expect(createTrackingLinkMock).toHaveBeenCalledWith({ embarqueId: "emb-1" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ id: "link-1", embarque_id: "emb-1" });
  });

  it("propaga errores del servicio", async () => {
    createTrackingLinkMock.mockRejectedValueOnce(new Error("forbidden"));
    const wrapper = createWrapper();
    const { result } = renderHook(() => useCreateTrackingLink(), { wrapper });
    await act(async () => {
      await expect(result.current.mutateAsync({ embarqueId: "emb-2" })).rejects.toThrow("forbidden");
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});
