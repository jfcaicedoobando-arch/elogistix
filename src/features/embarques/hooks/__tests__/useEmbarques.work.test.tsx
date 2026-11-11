import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  full: vi.fn(), detail: vi.fn(), list: vi.fn(), export: vi.fn(), extras: vi.fn(),
  docs: vi.fn(), facturas: vi.fn(), notas: vi.fn(), ventas: vi.fn(), costos: vi.fn(),
  filters: { search: "", debouncedSearch: "", filters: { modo: "todos", estado: "todos", cliente: "todos", operador: "todos", fechaDesde: "", fechaHasta: "" },
    alerta: "todos", page: 0, pageSize: 50, sortKey: "expediente", sortDir: "desc", DEFAULT_PAGE_SIZE: 50,
    setSearch: vi.fn(), setFilter: vi.fn(), setAlerta: vi.fn(), setPageRaw: vi.fn(), setPageSizeRaw: vi.fn(), setSortKeyRaw: vi.fn(), setSortDirRaw: vi.fn() },
}));
vi.mock("@/features/embarques/services", () => ({
  fetchEmbarqueFull: mock.full, fetchEmbarqueById: mock.detail, fetchEmbarquesPaginados: mock.list,
  fetchEmbarquesParaExport: mock.export, fetchEmbarquesListExtras: mock.extras,
}));
vi.mock("@/features/embarques/services/queries", () => ({ SORT_KEY_TO_COLUMN: { expediente: "expediente_num" } }));
vi.mock("@/hooks/shared", () => ({ useOrgFilter: () => ({ organizationId: "org-1", orgListo: true }) }));
vi.mock("@/hooks/shared/useOrgFilter", () => ({ useOrgFilter: () => ({ organizationId: "org-1", orgListo: true }) }));
vi.mock("@/features/embarques/hooks/useEmbarques", async () => ({ useEmbarquesPaginados: (await import("../useEmbarqueQueries")).useEmbarquesPaginados }));
vi.mock("../useEmbarquesFilters", () => ({ useEmbarquesFilters: () => mock.filters }));
vi.mock("../useEmbarquesAlertasResumen", () => ({ useEmbarquesAlertasResumen: () => ({ data: { demora: 10 }, isError: false, refetch: vi.fn() }) }));
vi.mock("@/features/embarques/services/queries/detalleSecciones", () => ({
  fetchEmbarqueCostosDetalle: mock.costos, fetchEmbarqueVentasDetalle: mock.ventas,
  fetchEmbarqueDocumentosDetalle: mock.docs, fetchEmbarqueFacturasDetalle: mock.facturas,
  fetchEmbarqueNotasDetalle: mock.notas,
}));
import { useEmbarqueResumen, usePrefetchEmbarque } from "../useEmbarqueQueries";
import { useEmbarqueDetalleTabsData } from "../useEmbarqueDetalleTabsData";
import { useEmbarquesPageState } from "../useEmbarquesPageState";
import type { EmbarqueRow } from "@/features/embarques/types/embarque";

const EMBARQUE_ID = "00000000-0000-4000-8000-000000000002";
const EMBARQUE = { id: EMBARQUE_ID, expediente: "ELIMP2" } as EmbarqueRow;
let client: QueryClient;
function wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={client}>{children}</QueryClientProvider>; }
beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60000 } } });
  vi.clearAllMocks();
  mock.full.mockResolvedValue({ embarque: { id: "e2" } });
  mock.detail.mockResolvedValue(EMBARQUE);
  mock.docs.mockResolvedValue([{ id: "doc-1" }]);
  mock.ventas.mockResolvedValue([]);
  mock.costos.mockResolvedValue([]);
  mock.list.mockResolvedValue({ data: [], count: 2500, extras: {} });
  mock.export.mockResolvedValue([]);
  mock.extras.mockResolvedValue({});
  mock.filters.filters.estado = "todos";
  mock.filters.alerta = "todos";
  mock.filters.page = 0;
});
afterEach(() => { client.clear(); vi.useRealTimers(); });
describe("shipment request work", () => {
  it.each(["estado", "alerta"])("pide una sola página al servidor con filtro de %s", async (filter) => {
    if (filter === "estado") mock.filters.filters.estado = "En Tránsito";
    else mock.filters.alerta = "demora";
    const { result, rerender } = renderHook(() => useEmbarquesPageState(), { wrapper });
    await waitFor(() => expect(result.current.totalCount).toBe(2500));
    const filtros = {
      filterEstado: mock.filters.filters.estado, filterAlerta: mock.filters.alerta,
      pageSize: 50, agruparExpedientes: true, organizationId: "org-1",
    };
    expect(mock.list).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ ...filtros, page: 0 }));
    expect(result.current.totalPages).toBe(50);
    mock.filters.page = 1;
    rerender();
    await waitFor(() => expect(mock.list).toHaveBeenCalledTimes(2));
    expect(mock.list).toHaveBeenLastCalledWith(expect.objectContaining({ ...filtros, page: 1 }));
    expect(mock.export).not.toHaveBeenCalled();
    expect(mock.extras).not.toHaveBeenCalled();
  });
  it("anticipa sólo el resumen y reutiliza esa lectura al abrir el embarque", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => usePrefetchEmbarque(), { wrapper });
    act(() => { result.current("e1"); result.current(EMBARQUE_ID); });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    expect(mock.detail).toHaveBeenCalledExactlyOnceWith(EMBARQUE_ID);
    expect(mock.full).not.toHaveBeenCalled();
    const detail = renderHook(() => useEmbarqueResumen(EMBARQUE_ID), { wrapper });
    expect(detail.result.current.embarque).toEqual(EMBARQUE);
    expect(mock.detail).toHaveBeenCalledTimes(1);
  });
  it("does not prefetch after unmount", async () => {
    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => usePrefetchEmbarque(), { wrapper });
    act(() => result.current("e1"));
    unmount();
    await vi.advanceTimersByTimeAsync(200);
    expect(mock.detail).not.toHaveBeenCalled();
    expect(mock.full).not.toHaveBeenCalled();
  });
  it("pide sólo los datos de la pestaña activa y comparte documentos con Cierre", async () => {
    const { result, rerender } = renderHook(({ tab }) => useEmbarqueDetalleTabsData(EMBARQUE, tab), {
      wrapper, initialProps: { tab: "resumen" },
    });
    const fetchers = [mock.docs, mock.facturas, mock.notas, mock.ventas, mock.costos];
    expect(fetchers.every((fetcher) => fetcher.mock.calls.length === 0)).toBe(true);
    rerender({ tab: "documentos" });
    await waitFor(() => expect(result.current.documentos).toEqual([{ id: "doc-1" }]));
    expect(mock.docs).toHaveBeenCalledExactlyOnceWith(EMBARQUE_ID);
    expect(fetchers.slice(1).every((fetcher) => fetcher.mock.calls.length === 0)).toBe(true);
    rerender({ tab: "cierre" });
    expect(result.current.documentos).toHaveLength(1);
    expect(mock.docs).toHaveBeenCalledTimes(1);
    rerender({ tab: "costos" });
    await waitFor(() => expect(mock.ventas).toHaveBeenCalledExactlyOnceWith(EMBARQUE_ID));
    expect(mock.costos).toHaveBeenCalledExactlyOnceWith(EMBARQUE_ID);
    expect(mock.facturas).not.toHaveBeenCalled();
    expect(mock.notas).not.toHaveBeenCalled();
    expect(mock.full).not.toHaveBeenCalled();
  });
});
