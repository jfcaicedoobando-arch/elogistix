import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
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
});
