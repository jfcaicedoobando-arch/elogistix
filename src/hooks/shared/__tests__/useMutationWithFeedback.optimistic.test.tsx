import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMutationWithFeedback } from "@/hooks/shared/useMutationWithFeedback";

vi.mock("@/components/shared/utils/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  (globalThis as unknown as { __TEST_QUERY_CLIENT__?: QueryClient }).__TEST_QUERY_CLIENT__ = client;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("useMutationWithFeedback · optimistic", () => {
  beforeEach(() => vi.clearAllMocks());

  it("aplica update optimista y lo confirma en éxito", async () => {
    const { client, wrapper } = makeWrapper();
    const key = ["item", "1"];
    client.setQueryData(key, { id: "1", estado: "pendiente" });

    const { result } = renderHook(
      () => ({
        q: useQuery({ queryKey: key, queryFn: () => ({ id: "1", estado: "pendiente" }) }),
        m: useMutationWithFeedback<{ ok: true }, Error, { estado: string }>({
          mutationFn: async () => ({ ok: true }),
          optimistic: {
            queryKey: key,
            updater: (old, vars) => ({ ...(old as object), estado: vars.estado }),
          },
        }),
      }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.q.data).toBeDefined());

    await act(async () => {
      await result.current.m.mutateAsync({ estado: "enviado" });
    });

    expect((client.getQueryData(key) as { estado: string }).estado).toBe("enviado");
  });

  it("hace rollback al valor previo si la mutación falla", async () => {
    const { client, wrapper } = makeWrapper();
    const key = ["item", "2"];
    client.setQueryData(key, { id: "2", estado: "pendiente" });

    const { result } = renderHook(
      () =>
        useMutationWithFeedback<never, Error, { estado: string }>({
          mutationFn: async () => {
            throw new Error("boom");
          },
          optimistic: {
            queryKey: key,
            updater: (old, vars) => ({ ...(old as object), estado: vars.estado }),
          },
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({ estado: "enviado" }).catch(() => {});
    });

    expect((client.getQueryData(key) as { estado: string }).estado).toBe("pendiente");
  });
});
