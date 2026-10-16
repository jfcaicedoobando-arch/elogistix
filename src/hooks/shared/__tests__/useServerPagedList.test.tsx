/**
 * Tests del primitivo `useServerPagedList` (Ola 1 · Filtros globales).
 *
 * Verifica que el hook combina bien:
 *  - URL sync de search, filtros, sort/dir y paginación
 *  - fetcher que recibe TODO el estado
 *  - resultado {rows, count} y prop `pagination` lista para el DataTable
 */
import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { PropsWithChildren } from "react";
import { useServerPagedList } from "@/hooks/shared/useServerPagedList";

function buildWrapper(searchParams?: Record<string, string>) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const NuqsWrap = withNuqsTestingAdapter({ hasMemory: true, searchParams });
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={qc}>
      <NuqsWrap>{children}</NuqsWrap>
    </QueryClientProvider>
  );
}

interface Filters extends Record<string, string> { estado: string }
const DEFAULTS: Filters = { estado: "todos" };

describe("useServerPagedList", () => {
  it.each([
    { page: "2", ps: "0", expectedPage: 2 },
    { page: "2", ps: "-20", expectedPage: 2 },
    { page: "2", ps: "9007199254740991", expectedPage: 2 },
    { page: "2", ps: "21", expectedPage: 2 },
    { page: "-1", ps: "20", expectedPage: 0 },
    { page: "9007199254740991", ps: "20", expectedPage: 0 },
  ])("normaliza page=$page y ps=$ps antes de consultar", async ({ page, ps, expectedPage }) => {
    const fetcher = vi.fn().mockResolvedValue({ rows: [], count: 101 });
    const { result } = renderHook(
      () => useServerPagedList({
        queryKey: ["test-invalid-pagination"],
        fetcher,
        defaultFilters: DEFAULTS,
        defaultPageSize: 20,
      }),
      { wrapper: buildWrapper({ page, ps }) },
    );

    await waitFor(() => expect(result.current.count).toBe(101));
    // Todas las llamadas, incluida la primera, deben llegar con un rango seguro.
    for (const [args] of fetcher.mock.calls) {
      expect(args).toMatchObject({
        page: expectedPage,
        pageSize: 20,
        range: { from: expectedPage * 20, to: (expectedPage + 1) * 20 - 1 },
      });
    }
    expect(result.current.totalPages).toBe(6);
    expect(result.current.pagination.page).toBe(expectedPage);
    expect(result.current.pagination.pageSize).toBe(20);
  });

  it.each([
    { pageSizeOptions: [50, 100, 200], size: 200 },
    { pageSizeOptions: [50, 100, 200, 500], size: 500 },
  ])("conserva ps=$size con las opciones propias del listado", async ({ pageSizeOptions, size }) => {
    const fetcher = vi.fn().mockResolvedValue({ rows: [], count: 801 });
    const { result } = renderHook(
      () => useServerPagedList({
        queryKey: ["test-custom-pagination"],
        fetcher,
        defaultFilters: DEFAULTS,
        defaultPageSize: 100,
        pageSizeOptions,
      }),
      { wrapper: buildWrapper({ page: "2", ps: String(size) }) },
    );

    await waitFor(() => expect(result.current.count).toBe(801));
    expect(fetcher.mock.calls[0][0]).toMatchObject({
      page: 2,
      pageSize: size,
      range: { from: 2 * size, to: 3 * size - 1 },
    });
    expect(result.current.totalPages).toBe(Math.ceil(801 / size));
    expect(result.current.pagination.pageSizeOptions).toEqual(pageSizeOptions);
  });

  it("llama al fetcher con el estado inicial y expone rows/count", async () => {
    const fetcher = vi.fn().mockResolvedValue({ rows: [{ id: "1" }, { id: "2" }], count: 42 });
    const { result } = renderHook(
      () =>
        useServerPagedList<{ id: string }, Filters>({
          queryKey: ["test-list"],
          fetcher,
          defaultFilters: DEFAULTS,
          defaultPageSize: 20,
          defaultSort: { key: "fecha", dir: "desc" },
        }),
      { wrapper: buildWrapper() },
    );

    await waitFor(() => expect(result.current.rows).toHaveLength(2));
    expect(result.current.count).toBe(42);
    expect(result.current.totalPages).toBe(Math.ceil(42 / 20));
    expect(fetcher).toHaveBeenCalledTimes(1);
    const args = fetcher.mock.calls[0][0];
    expect(args.search).toBe("");
    expect(args.filters).toEqual({ estado: "todos" });
    expect(args.sortKey).toBe("fecha");
    expect(args.sortDir).toBe("desc");
    expect(args.range).toEqual({ from: 0, to: 19 });
  });

  it("marca isPlaceholderData mientras llega la consulta del nuevo filtro", async () => {
    // Regresión: al cambiar de pestaña/filtro, TanStack sirve las filas de la
    // consulta anterior (placeholderData). La UI debe poder distinguirlo para
    // pintar esqueleto y no operar sobre filas del segmento equivocado.
    let resolverNuevaConsulta: ((v: { rows: { id: string }[]; count: number }) => void) | null = null;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: "cliente-1" }], count: 1 })
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolverNuevaConsulta = resolve;
          }),
      );
    const { result } = renderHook(
      () =>
        useServerPagedList<{ id: string }, Filters>({
          queryKey: ["test-list"],
          fetcher,
          defaultFilters: DEFAULTS,
        }),
      { wrapper: buildWrapper() },
    );
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.isPlaceholderData).toBe(false);

    await act(async () => { result.current.setFilter("estado", "Pagada"); });
    // Mientras la nueva consulta está pendiente, las filas son de la anterior.
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(true));
    expect(result.current.rows).toEqual([{ id: "cliente-1" }]);

    expect(result.current.isStaleView).toBe(true);
    await act(async () => { resolverNuevaConsulta?.({ rows: [], count: 0 }); });
    await waitFor(() => expect(result.current.isPlaceholderData).toBe(false));
    expect(result.current.rows).toEqual([]);
    expect(result.current.isStaleView).toBe(false);
  });

  it("P2-4: isStaleView cubre el debounce de búsqueda", async () => {
    const fetcher = vi.fn().mockResolvedValue({ rows: [{ id: "aceros-mty" }], count: 1 });
    const { result } = renderHook(
      () => useServerPagedList<{ id: string }, Filters>({ queryKey: ["test-stale"], fetcher, defaultFilters: DEFAULTS }),
      { wrapper: buildWrapper() },
    );
    await waitFor(() => expect(result.current.rows).toHaveLength(1));
    expect(result.current.isStaleView).toBe(false);
    act(() => { result.current.setSearch("logistica regia"); });
    // Durante el debounce las filas son de la búsqueda previa: vista obsoleta.
    await waitFor(() => expect(result.current.search).toBe("logistica regia"));
    expect(result.current.isStaleView).toBe(true);
  });

  it("refetch cuando cambia search o filtros", async () => {
    const fetcher = vi.fn().mockResolvedValue({ rows: [], count: 0 });
    const { result } = renderHook(
      () =>
        useServerPagedList<{ id: string }, Filters>({
          queryKey: ["test-list"],
          fetcher,
          defaultFilters: DEFAULTS,
        }),
      { wrapper: buildWrapper() },
    );
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(1));

    await act(async () => { result.current.setSearch("hola"); });
    await waitFor(() => {
      const last = fetcher.mock.calls.at(-1)?.[0];
      expect(last?.search).toBe("hola");
    });

    await act(async () => { result.current.setFilter("estado", "Pagada"); });
    await waitFor(() => {
      const last = fetcher.mock.calls.at(-1)?.[0];
      expect(last?.filters.estado).toBe("Pagada");
    });
  });

  it("setSort actualiza controlledSort y refetch con nueva key", async () => {
    const fetcher = vi.fn().mockResolvedValue({ rows: [], count: 0 });
    const { result } = renderHook(
      () =>
        useServerPagedList<{ id: string }, Filters>({
          queryKey: ["test-list"],
          fetcher,
          defaultFilters: DEFAULTS,
          defaultSort: { key: "fecha", dir: "desc" },
        }),
      { wrapper: buildWrapper() },
    );
    await waitFor(() => expect(fetcher).toHaveBeenCalled());

    await act(async () => { result.current.setSort("monto", "asc"); });
    expect(result.current.controlledSort).toEqual({ key: "monto", dir: "asc" });
    await waitFor(() => {
      const last = fetcher.mock.calls.at(-1)?.[0];
      expect(last?.sortKey).toBe("monto");
      expect(last?.sortDir).toBe("asc");
    });
  });

  it("pagination.onPageChange dispara refetch con nuevo range", async () => {
    const fetcher = vi.fn().mockResolvedValue({ rows: [], count: 100 });
    const { result } = renderHook(
      () =>
        useServerPagedList<{ id: string }, Filters>({
          queryKey: ["test-list"],
          fetcher,
          defaultFilters: DEFAULTS,
          defaultPageSize: 10,
        }),
      { wrapper: buildWrapper() },
    );
    await waitFor(() => expect(fetcher).toHaveBeenCalled());

    await act(async () => { result.current.pagination.onPageChange(2); });
    await waitFor(() => {
      const last = fetcher.mock.calls.at(-1)?.[0];
      expect(last?.range).toEqual({ from: 20, to: 29 });
    });
  });
});
