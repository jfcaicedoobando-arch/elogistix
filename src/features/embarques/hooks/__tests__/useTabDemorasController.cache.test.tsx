import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ update: vi.fn(), full: vi.fn() }));
vi.mock("@/features/embarques/hooks", () => ({
  useContenedoresEmbarque: () => ({ data: [], isLoading: false }),
}));
vi.mock("@/features/embarques/services/contenedores", () => ({
  actualizarDemorasContenedor: mocks.update,
}));
vi.mock("@/features/embarques/services", () => ({ fetchEmbarqueFull: mocks.full }));
vi.mock("@/lib/ui/appFeedback", () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));
import { queryKeys } from "@/lib/query";
import { useTabDemorasController } from "../useTabDemorasController";
import { useEmbarqueFull } from "../useEmbarqueFullQuery";

function setup() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  client.setQueryData(queryKeys.embarques.full("A"), { total: 32.11 });
  client.setQueryData(queryKeys.embarques.full("B"), { total: 99 });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const view = renderHook(({ id }) => ({
    controller: useTabDemorasController(id),
    header: useEmbarqueFull(id),
  }), { wrapper, initialProps: { id: "A" } });
  return { client, ...view };
}

beforeEach(() => vi.resetAllMocks());

describe("AUD147 container save refreshes the shipment header cache", () => {
  it.each([25.11, 39.11])("refreshes the active full query to %s without reload", async (total) => {
    mocks.update.mockResolvedValue(undefined);
    mocks.full.mockResolvedValue({ total });
    const { client, result, unmount } = setup();
    expect(mocks.full).not.toHaveBeenCalled(); // Header is still fresh for 30 seconds.
    act(() => result.current.controller.setDraft("container-A", { fecha_devolucion: "2026-10-10" }));
    act(() => result.current.controller.guardar("container-A"));
    await waitFor(() => expect(client.getQueryData(queryKeys.embarques.full("A"))).toEqual({ total }));
    expect(mocks.full).toHaveBeenCalledWith("A");
    expect(client.getQueryData(queryKeys.embarques.full("B"))).toEqual({ total: 99 });
    expect(client.getQueryState(queryKeys.embarques.full("B"))?.isInvalidated).toBe(false);
    unmount(); client.clear();
  });

  it("re-reads totals after an error that may follow trigger materialization", async () => {
    mocks.update.mockRejectedValue(new Error("transport failed after database commit"));
    mocks.full.mockResolvedValue({ total: 25.11 });
    const { client, result, unmount } = setup();
    act(() => result.current.controller.setDraft("container-A", { fecha_devolucion: "2026-10-10" }));
    act(() => result.current.controller.guardar("container-A"));
    await waitFor(() => expect(client.getQueryData(queryKeys.embarques.full("A"))).toEqual({ total: 25.11 }));
    expect(result.current.controller.drafts["container-A"]).toBeDefined();
    unmount(); client.clear();
  });

  it("invalidates the submitted shipment after navigation, not the new header", async () => {
    let finish!: () => void;
    mocks.update.mockImplementation(() => new Promise<void>((resolve) => { finish = resolve; }));
    const { client, result, rerender, unmount } = setup();
    act(() => result.current.controller.setDraft("container-A", { fecha_devolucion: "2026-10-10" }));
    act(() => result.current.controller.guardar("container-A"));
    await waitFor(() => expect(mocks.update).toHaveBeenCalledTimes(1));
    rerender({ id: "B" });
    await act(async () => finish());
    await waitFor(() => expect(client.getQueryState(queryKeys.embarques.full("A"))?.isInvalidated).toBe(true));
    expect(client.getQueryState(queryKeys.embarques.full("B"))?.isInvalidated).toBe(false);
    expect(mocks.full).not.toHaveBeenCalled();
    unmount(); client.clear();
  });
});
