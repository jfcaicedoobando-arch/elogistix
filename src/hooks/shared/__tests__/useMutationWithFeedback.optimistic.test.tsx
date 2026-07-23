import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMutationWithFeedback } from "@/hooks/shared/useMutationWithFeedback";

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
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

  it("aplica update optimista sobre el cache antes de resolver", async () => {
    const { client, wrapper } = makeWrapper();
    const key = ["item", "1"];
    client.setQueryData(key, { id: "1", estado: "pendiente" });

    let cacheDuranteMutacion: unknown = null;

    const { result } = renderHook(
      () =>
        useMutationWithFeedback<{ ok: true }, Error, { estado: string }>({
          mutationFn: async () => {
            cacheDuranteMutacion = client.getQueryData(key);
            return { ok: true };
          },
          optimistic: {
            queryKey: key,
            updater: (old, vars) => ({ ...(old as object), estado: vars.estado }),
          },
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({ estado: "enviado" });
    });

    expect((cacheDuranteMutacion as { estado: string }).estado).toBe("enviado");
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
