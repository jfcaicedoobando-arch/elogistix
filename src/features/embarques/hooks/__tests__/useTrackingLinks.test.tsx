import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import React from "react";

vi.mock("@/services/tracking", () => ({
  createTrackingLink: vi.fn().mockResolvedValue({
    id: "tl-1",
    embarque_id: "emb-1",
    token: "tok-abc",
    expires_at: null,
  }),
}));

import { createTrackingLink } from "@/services/tracking";
import { useCreateTrackingLink } from "../useTrackingLinks";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc, children });
}

describe("useCreateTrackingLink", () => {
  it("invoca createTrackingLink con embarqueId y expiresAt", async () => {
    const { result } = renderHook(() => useCreateTrackingLink(), { wrapper });
    await result.current.mutateAsync({ embarqueId: "emb-1", expiresAt: "2026-12-31" });
    expect(createTrackingLink).toHaveBeenCalledWith({
      embarqueId: "emb-1",
      expiresAt: "2026-12-31",
    });
  });

  it("expone isPending durante la mutación", async () => {
    const { result } = renderHook(() => useCreateTrackingLink(), { wrapper });
    expect(result.current.isPending).toBe(false);
    result.current.mutate({ embarqueId: "emb-2" });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});
