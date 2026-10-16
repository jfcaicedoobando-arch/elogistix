import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { useListPageState, DEFAULT_PAGE_SIZE } from "@/hooks/shared";

describe("useListPageState (nuqs adapter)", () => {
  it("inicializa con defaults", () => {
    const { result } = renderHook(
      () => useListPageState({ estado: "todos", cliente: "todos" }),
      { wrapper: withNuqsTestingAdapter({ hasMemory: true }) },
    );
    expect(result.current.search).toBe("");
    expect(result.current.filters).toEqual({ estado: "todos", cliente: "todos" });
    expect(result.current.page).toBe(0);
    expect(result.current.pageSize).toBe(DEFAULT_PAGE_SIZE);
  });

  it("setSearch resetea la página a 0", async () => {
    const { result } = renderHook(
      () => useListPageState({ estado: "todos" }),
      { wrapper: withNuqsTestingAdapter({ hasMemory: true }) },
    );
    await act(async () => { await result.current.setPage(3); });
    expect(result.current.page).toBe(3);
    await act(async () => { await result.current.setSearch("foo"); });
    expect(result.current.search).toBe("foo");
    expect(result.current.page).toBe(0);
  });

  it("setFilter actualiza solo la clave especificada y resetea página", async () => {
    const { result } = renderHook(
      () => useListPageState({ estado: "todos", cliente: "todos" }),
      { wrapper: withNuqsTestingAdapter({ hasMemory: true }) },
    );
    await act(async () => { await result.current.setPage(2); });
    await act(async () => { await result.current.setFilter("estado", "Aceptada"); });
    expect(result.current.filters).toEqual({ estado: "Aceptada", cliente: "todos" });
    expect(result.current.page).toBe(0);
  });

  it("paginate corta el array y calcula totalPages", async () => {
    const { result } = renderHook(() => useListPageState({}, 5), {
      wrapper: withNuqsTestingAdapter({ hasMemory: true }),
    });
    const items = Array.from({ length: 12 }, (_, i) => i);
    const p1 = result.current.paginate(items);
    expect(p1.items).toEqual([0, 1, 2, 3, 4]);
    expect(p1.totalPages).toBe(3);
    await act(async () => { await result.current.setPage(2); });
    const p3 = result.current.paginate(items);
    expect(p3.items).toEqual([10, 11]);
  });

  it("paginate devuelve totalPages>=1 incluso para arrays vacíos", () => {
    const { result } = renderHook(() => useListPageState({}), {
      wrapper: withNuqsTestingAdapter({ hasMemory: true }),
    });
    expect(result.current.paginate([]).totalPages).toBe(1);
  });

  it.each(["0", "-20", "999999999", "9007199254740992"])(
    "normaliza ps=%s antes de paginar sin reescribir la URL al montar",
    async (ps) => {
      const onUrlUpdate = vi.fn();
      const { result } = renderHook(() => useListPageState({}, 100, [50, 100, 200, 500]), {
        wrapper: withNuqsTestingAdapter({ hasMemory: true, searchParams: { ps }, onUrlUpdate }),
      });

      expect(result.current.pageSize).toBe(100);
      const items = Array.from({ length: 250 }, (_, i) => i);
      expect(result.current.paginate(items)).toEqual({ items: items.slice(0, 100), totalPages: 3 });
      await act(async () => {});
      expect(onUrlUpdate).not.toHaveBeenCalled();
    },
  );

  it.each(["-1", "-999", "90071992547409", "9007199254740992"])(
    "normaliza page=%s antes de calcular offsets",
    (page) => {
      const { result } = renderHook(() => useListPageState({}, 100), {
        wrapper: withNuqsTestingAdapter({ hasMemory: true, searchParams: { page } }),
      });
      expect(result.current.page).toBe(0);
      expect(result.current.paginate([1, 2, 3]).items).toEqual([1, 2, 3]);
    },
  );

  it.each([50, 100, 200, 500])("conserva la URL y el tamaño admitido %i", async (ps) => {
    const onUrlUpdate = vi.fn();
    const { result } = renderHook(() => useListPageState({ estado: "todos" }, 100, [50, 100, 200, 500]), {
      wrapper: withNuqsTestingAdapter({
        hasMemory: true,
        searchParams: { page: "2", ps: String(ps), q: "acme", estado: "pendiente" },
        onUrlUpdate,
      }),
    });
    expect(result.current.page).toBe(2);
    expect(result.current.pageSize).toBe(ps);
    expect(result.current.search).toBe("acme");
    expect(result.current.filters.estado).toBe("pendiente");
    await act(async () => {});
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it("incluye el default personalizado entre las opciones admitidas", () => {
    const { result } = renderHook(() => useListPageState({}, 5, [10, 20]), {
      wrapper: withNuqsTestingAdapter({ hasMemory: true, searchParams: { ps: "5" } }),
    });
    expect(result.current.pageSize).toBe(5);
  });

  it.each([20, 75, 500])("rechaza ps=%i si el listado no lo ofrece", (ps) => {
    const { result } = renderHook(() => useListPageState({}, 100, [50, 100, 200]), {
      wrapper: withNuqsTestingAdapter({ hasMemory: true, searchParams: { ps: String(ps) } }),
    });
    expect(result.current.pageSize).toBe(100);
  });

  it.each([[3, 3], [6, 5]])("sin opciones admite 1..defaultPageSize: ps=%i", (ps, expected) => {
    const { result } = renderHook(() => useListPageState({}, 5), {
      wrapper: withNuqsTestingAdapter({ hasMemory: true, searchParams: { ps: String(ps) } }),
    });
    expect(result.current.pageSize).toBe(expected);
  });

  it.each([0, -1, 999999999, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
    "setPageSize(%s) vuelve al default y limpia page/ps conservando filtros",
    async (size) => {
      const onUrlUpdate = vi.fn();
      const { result } = renderHook(() => useListPageState({ estado: "todos" }, 100, [50, 100, 200, 500]), {
        wrapper: withNuqsTestingAdapter({
          hasMemory: true,
          searchParams: { page: "2", ps: "50", q: "acme", estado: "pendiente" },
          onUrlUpdate,
        }),
      });
      await act(async () => { result.current.setPageSize(size); });
      expect(result.current.pageSize).toBe(100);
      expect(result.current.page).toBe(0);
      await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
      const params = onUrlUpdate.mock.calls.at(-1)?.[0].searchParams as URLSearchParams;
      expect(params.has("page")).toBe(false);
      expect(params.has("ps")).toBe(false);
      expect(params.get("q")).toBe("acme");
      expect(params.get("estado")).toBe("pendiente");
    },
  );

  it.each([-1, Number.MAX_SAFE_INTEGER, Number.NaN, Number.POSITIVE_INFINITY, 1.5])(
    "setPage(%s) no expone páginas negativas ni offsets inseguros",
    async (page) => {
      const { result } = renderHook(() => useListPageState({}, 100), {
        wrapper: withNuqsTestingAdapter({ hasMemory: true, searchParams: { page: "2" } }),
      });
      await act(async () => { result.current.setPage(page); });
      expect(result.current.page).toBe(0);
    },
  );

  it("cambia a otro tamaño válido y resetea la página", async () => {
    const { result } = renderHook(() => useListPageState({}, 100, [50, 100, 200, 500]), {
      wrapper: withNuqsTestingAdapter({ hasMemory: true, searchParams: { page: "3", ps: "50" } }),
    });
    await act(async () => { result.current.setPageSize(500); });
    expect(result.current.pageSize).toBe(500);
    expect(result.current.page).toBe(0);
  });

  it("mantiene setters estables con opciones inline equivalentes", () => {
    const { result, rerender } = renderHook(() => useListPageState({}, 100, [50, 100, 200, 500]), {
      wrapper: withNuqsTestingAdapter({ hasMemory: true }),
    });
    const { setPage, setPageSize, resetPage } = result.current;
    rerender();
    expect(result.current.setPage).toBe(setPage);
    expect(result.current.setPageSize).toBe(setPageSize);
    expect(result.current.resetPage).toBe(resetPage);
  });
});
