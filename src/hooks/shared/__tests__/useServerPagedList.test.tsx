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

function buildWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const NuqsWrap = withNuqsTestingAdapter({ hasMemory: true });
  return ({ children }: PropsWithChildren) => (
    <QueryClientProvider client={qc}>
      <NuqsWrap>{children}</NuqsWrap>
    </QueryClientProvider>
  );
}

interface Filters extends Record<string, string> { estado: string }
const DEFAULTS: Filters = { estado: "todos" };

describe("useServerPagedList", () => {
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
