import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ full: vi.fn(), detail: vi.fn(), list: vi.fn(), export: vi.fn(), extras: vi.fn(),
  filters: { search: "", debouncedSearch: "", filters: { modo: "todos", estado: "todos", cliente: "todos", operador: "todos", fechaDesde: "", fechaHasta: "" },
    alerta: "todos", page: 0, pageSize: 50, sortKey: "expediente", sortDir: "desc", DEFAULT_PAGE_SIZE: 50,
    setSearch: vi.fn(), setFilter: vi.fn(), setAlerta: vi.fn(), setPageRaw: vi.fn(), setPageSizeRaw: vi.fn(), setSortKeyRaw: vi.fn(), setSortDirRaw: vi.fn() },
}));
vi.mock("@/features/embarques/services", () => ({
  fetchEmbarqueFull: mock.full, fetchEmbarqueById: mock.detail, fetchEmbarquesPaginados: mock.list,
  fetchEmbarquesParaExport: mock.export, fetchEmbarquesListExtras: mock.extras,
}));
vi.mock("@/features/embarques/services/queries", () => ({ SORT_KEY_TO_COLUMN: { expediente: "expediente_num" } }));
vi.mock("@/hooks/shared", () => ({ useOrgFilter: () => ({ organizationId: "org-1" }) }));
vi.mock("@/hooks/shared/useOrgFilter", () => ({ useOrgFilter: () => ({ organizationId: "org-1" }) }));
vi.mock("@/features/embarques/hooks/useEmbarques", async () => ({ useEmbarquesPaginados: (await import("../useEmbarqueQueries")).useEmbarquesPaginados }));
vi.mock("../useEmbarquesFilters", () => ({ useEmbarquesFilters: () => mock.filters }));
vi.mock("../useEmbarquesAlertasResumen", () => ({ useEmbarquesAlertasResumen: () => ({ data: { demora: new Set() }, isLoading: false, isError: false, refetch: vi.fn() }) }));
import { usePrefetchEmbarque } from "../useEmbarqueQueries";
import { useEmbarqueFull } from "../useEmbarqueFullQuery";
import { useEmbarquesPageState } from "../useEmbarquesPageState";
let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
  vi.clearAllMocks();
  mock.full.mockResolvedValue({ embarque: { id: "e2" } });
  mock.list.mockResolvedValue({ data: [], totalCount: 0, extras: {} });
  mock.export.mockResolvedValue([]);
  mock.extras.mockResolvedValue({});
  mock.filters.filters.estado = "todos";
  mock.filters.alerta = "todos";
  mock.filters.page = 0;
});
afterEach(() => { client.clear(); vi.useRealTimers(); });
describe("shipment request work", () => {
  it.each(["estado", "alerta"])("runs only the full-set branch for %s, including local page changes", async (filter) => {
    if (filter === "estado") mock.filters.filters.estado = "En tránsito";
    else mock.filters.alerta = "demora";
    const { rerender } = renderHook(() => useEmbarquesPageState(), { wrapper });
    await waitFor(() => expect(mock.export).toHaveBeenCalledTimes(1));
    expect(mock.list).not.toHaveBeenCalled();
    mock.filters.page = 1;
    rerender();
    expect(mock.list).not.toHaveBeenCalled();
    expect(mock.export).toHaveBeenCalledTimes(1);
    mock.filters.filters.estado = "todos";
    mock.filters.alerta = "todos";
    rerender();
    await waitFor(() => expect(mock.list).toHaveBeenCalledTimes(1));
  });
  it("coalesces row sweeps and reuses the exact full-detail cache on navigation", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePrefetchEmbarque(), { wrapper });
    act(() => { result.current("e1"); result.current("e2"); });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(mock.full).toHaveBeenCalledTimes(1);
    expect(mock.full).toHaveBeenCalledWith("e2");
    expect(mock.detail).not.toHaveBeenCalled();
    const detail = renderHook(() => useEmbarqueFull("e2"), { wrapper });
    expect(detail.result.current.data).toEqual({ embarque: { id: "e2" } });
    expect(mock.full).toHaveBeenCalledTimes(1);
  });
  it("does not prefetch after unmount", async () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => usePrefetchEmbarque(), { wrapper });
    act(() => result.current("e1"));
    unmount();
    await vi.advanceTimersByTimeAsync(200);
    expect(mock.full).not.toHaveBeenCalled();
  });
});
