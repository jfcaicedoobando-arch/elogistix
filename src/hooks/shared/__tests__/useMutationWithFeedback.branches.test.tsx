/**
 * Tests focalizados de branches para `useMutationWithFeedback`:
 * silent, successTitle, invalidate array, resolveKey función vs array,
 * ausencia de optimistic, rollback llamando notifyError.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";

vi.mock("@/lib/ui/appFeedback", () => ({
  notifySuccess: vi.fn(),
  notifyError: vi.fn(),
}));

import { useMutationWithFeedback } from "@/hooks/shared/useMutationWithFeedback";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";

const mockSuccess = vi.mocked(notifySuccess);
const mockError = vi.mocked(notifyError);

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity, staleTime: Infinity },
      mutations: { retry: false },
    },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("useMutationWithFeedback · branches", () => {
  beforeEach(() => vi.clearAllMocks());

  it("silent=true suprime toasts de éxito y error", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useMutationWithFeedback<{ ok: true }, Error, void>({
          mutationFn: async () => ({ ok: true }),
          successTitle: "Debería silenciarse",
          silent: true,
        }),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(mockSuccess).not.toHaveBeenCalled();
    expect(mockError).not.toHaveBeenCalled();
  });

  it("silent=true en fallo también silencia (aunque hay rollback si aplica)", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useMutationWithFeedback<never, Error, void>({
          mutationFn: async () => {
            throw new Error("nope");
          },
          errorTitle: "silenced",
          silent: true,
        }),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync().catch(() => {});
    });
    expect(mockError).not.toHaveBeenCalled();
  });

  it("dispara notifySuccess cuando hay successTitle y no es silent", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useMutationWithFeedback<{ ok: true }, Error, void>({
          mutationFn: async () => ({ ok: true }),
          successTitle: "Ok",
          successDescription: "Todo bien",
        }),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(mockSuccess).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ title: "Ok", description: "Todo bien" }),
    );
  });

  it("no dispara notifySuccess cuando no se define successTitle", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useMutationWithFeedback<{ ok: true }, Error, void>({
          mutationFn: async () => ({ ok: true }),
        }),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(mockSuccess).not.toHaveBeenCalled();
  });

  it("dispara notifyError con message del error cuando falla y no es silent", async () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(
      () =>
        useMutationWithFeedback<never, Error, void>({
          mutationFn: async () => {
            throw new Error("boom");
          },
          errorTitle: "Falló",
          errorMethod: "TEST_METHOD",
        }),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync().catch(() => {});
    });
    await waitFor(() => expect(mockError).toHaveBeenCalled());
    expect(mockError).toHaveBeenCalledWith(
      undefined,
      expect.objectContaining({ title: "Falló", description: "boom", method: "TEST_METHOD" }),
    );
  });

  it("invalidate: acepta un array de QueryKeys y las invalida todas", async () => {
    const { client, wrapper } = makeWrapper();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(
      () =>
        useMutationWithFeedback<{ ok: true }, Error, void>({
          mutationFn: async () => ({ ok: true }),
          invalidate: [["a"], ["b", 1]],
        }),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync();
    });
    const keys = spy.mock.calls.map((c) => c[0]?.queryKey);
    expect(keys).toEqual(expect.arrayContaining([["a"], ["b", 1]]));
  });

  it("invalidate: acepta una sola QueryKey (no array de arrays)", async () => {
    const { client, wrapper } = makeWrapper();
    const spy = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(
      () =>
        useMutationWithFeedback<{ ok: true }, Error, void>({
          mutationFn: async () => ({ ok: true }),
          invalidate: ["solo"],
        }),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync();
    });
    expect(spy.mock.calls.some((c) => Array.isArray(c[0]?.queryKey) && (c[0].queryKey as unknown[])[0] === "solo")).toBe(true);
  });

  it("optimistic con queryKey como función: resuelve la key con las variables", async () => {
    const { client, wrapper } = makeWrapper();
    client.setQueryData(["item", "9"], { id: "9", n: 0 });
    const { result } = renderHook(
      () =>
        useMutationWithFeedback<{ ok: true }, Error, { id: string; n: number }>({
          mutationFn: async () => ({ ok: true }),
          optimistic: {
            queryKey: (v) => ["item", v.id],
            updater: (old, v) => ({ ...(old as object), n: v.n }),
          },
        }),
      { wrapper },
    );
    await act(async () => {
      await result.current.mutateAsync({ id: "9", n: 42 });
    });
    expect((client.getQueryData(["item", "9"]) as { n: number }).n).toBe(42);
  });

  it("propaga onSuccess/onError del consumidor", async () => {
    const onSuccess = vi.fn();
    const onError = vi.fn();
    const { wrapper } = makeWrapper();
    const { result: okHook } = renderHook(
      () =>
        useMutationWithFeedback<{ ok: true }, Error, void>({
          mutationFn: async () => ({ ok: true }),
          onSuccess,
        }),
      { wrapper },
    );
    await act(async () => {
      await okHook.current.mutateAsync();
    });
    expect(onSuccess).toHaveBeenCalled();

    const { result: errHook } = renderHook(
      () =>
        useMutationWithFeedback<never, Error, void>({
          mutationFn: async () => {
            throw new Error("x");
          },
          onError,
        }),
      { wrapper },
    );
    await act(async () => {
      await errHook.current.mutateAsync().catch(() => {});
    });
    expect(onError).toHaveBeenCalled();
  });
});
