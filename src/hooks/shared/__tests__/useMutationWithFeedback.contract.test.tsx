/**
 * P1-C — Contrato TanStack Query v5 de `useMutationWithFeedback`.
 *
 * Verifica que el wrapper reenvía TODOS los argumentos oficiales (variables +
 * MutationFunctionContext + resultado de onMutate) a mutationFn/onMutate/
 * onSuccess/onError/onSettled, que el retorno de `onMutate` del consumer llega
 * intacto a los callbacks posteriores, el orden feedback→callback y que no se
 * duplican los toasts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useMutationWithFeedback } from "@/hooks/shared/useMutationWithFeedback";
import { notifySuccess, notifyError } from "@/lib/ui/appFeedback";

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
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe("useMutationWithFeedback · contrato v5", () => {
  beforeEach(() => vi.clearAllMocks());

  it("reenvía variables y MutationFunctionContext a mutationFn y onMutate", async () => {
    const { client, wrapper } = makeWrapper();
    const mutationFn = vi.fn(async () => ({ ok: true }));
    const onMutate = vi.fn(() => ({ marca: 1 }));

    const { result } = renderHook(
      () =>
        useMutationWithFeedback<{ ok: boolean }, Error, { id: string }, { marca: number }>({
          mutationFn,
          onMutate,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({ id: "a1" });
    });

    expect(mutationFn).toHaveBeenCalledTimes(1);
    expect(mutationFn.mock.calls[0][0]).toEqual({ id: "a1" });
    expect(mutationFn.mock.calls[0][1]).toMatchObject({ client });

    expect(onMutate).toHaveBeenCalledTimes(1);
    expect(onMutate.mock.calls[0][0]).toEqual({ id: "a1" });
    expect(onMutate.mock.calls[0][1]).toMatchObject({ client });
  });

  it("propaga el retorno de onMutate a onSuccess y onSettled", async () => {
    const { wrapper } = makeWrapper();
    const onSuccess = vi.fn();
    const onSettled = vi.fn();

    const { result } = renderHook(
      () =>
        useMutationWithFeedback<{ n: number }, Error, { id: string }, { marca: string }>({
          mutationFn: async () => ({ n: 7 }),
          onMutate: () => ({ marca: "ctx" }),
          onSuccess,
          onSettled,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({ id: "a1" });
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
    const [data, vars, ctxRes, fnCtx] = onSuccess.mock.calls[0];
    expect(data).toEqual({ n: 7 });
    expect(vars).toEqual({ id: "a1" });
    expect(ctxRes).toEqual({ marca: "ctx" });
    expect(fnCtx).toHaveProperty("client");

    expect(onSettled).toHaveBeenCalledTimes(1);
    const [sData, sError, sVars, sCtx] = onSettled.mock.calls[0];
    expect(sData).toEqual({ n: 7 });
    expect(sError).toBeNull();
    expect(sVars).toEqual({ id: "a1" });
    expect(sCtx).toEqual({ marca: "ctx" });
  });

  it("entrega error, variables y contexto completos a onError y onSettled", async () => {
    const { wrapper } = makeWrapper();
    const onError = vi.fn();
    const onSettled = vi.fn();
    const boom = new Error("boom");

    const { result } = renderHook(
      () =>
        useMutationWithFeedback<never, Error, { id: string }, { marca: string }>({
          mutationFn: async () => {
            throw boom;
          },
          onMutate: () => ({ marca: "ctx" }),
          onError,
          onSettled,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync({ id: "a1" }).catch(() => {});
    });

    expect(onError.mock.calls[0][0]).toBe(boom);
    expect(onError.mock.calls[0][1]).toEqual({ id: "a1" });
    expect(onError.mock.calls[0][2]).toEqual({ marca: "ctx" });
    expect(onError.mock.calls[0][3]).toHaveProperty("client");

    expect(onSettled.mock.calls[0][0]).toBeUndefined();
    expect(onSettled.mock.calls[0][1]).toBe(boom);
    expect(onSettled.mock.calls[0][3]).toEqual({ marca: "ctx" });
  });

  it("muestra un solo toast y lo hace ANTES del callback del consumer", async () => {
    const { wrapper } = makeWrapper();
    const orden: string[] = [];
    vi.mocked(notifySuccess).mockImplementation(() => {
      orden.push("toast");
      return "id";
    });

    const { result } = renderHook(
      () =>
        useMutationWithFeedback<{ ok: true }, Error, void>({
          mutationFn: async () => ({ ok: true }),
          successTitle: "Listo",
          onSuccess: () => {
            orden.push("callback");
          },
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync();
    });

    expect(notifySuccess).toHaveBeenCalledTimes(1);
    expect(notifyError).not.toHaveBeenCalled();
    expect(orden).toEqual(["toast", "callback"]);
  });

  it("silent=true no emite ningún toast pero sí ejecuta los callbacks", async () => {
    const { wrapper } = makeWrapper();
    const onError = vi.fn();

    const { result } = renderHook(
      () =>
        useMutationWithFeedback<never, Error, void>({
          mutationFn: async () => {
            throw new Error("x");
          },
          errorTitle: "Falló",
          silent: true,
          onError,
        }),
      { wrapper },
    );

    await act(async () => {
      await result.current.mutateAsync().catch(() => {});
    });

    expect(notifyError).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
