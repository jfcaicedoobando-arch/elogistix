import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { useListPageState } from "@/hooks/shared/useListPageState";

const wrapper = withNuqsTestingAdapter({ hasMemory: true });

describe("useListPageState", () => {
  it("inicializa con defaults", () => {
    const { result } = renderHook(
      () => useListPageState({ estado: "todos", cliente: "todos" }),
      { wrapper },
    );
    expect(result.current.search).toBe("");
    expect(result.current.filters).toEqual({ estado: "todos", cliente: "todos" });
    expect(result.current.page).toBe(0);
    expect(result.current.pageSize).toBe(20);
  });

  it("setSearch resetea la página a 0", () => {
    const { result } = renderHook(
      () => useListPageState({ estado: "todos" }),
      { wrapper },
    );
    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);
    act(() => result.current.setSearch("foo"));
    expect(result.current.search).toBe("foo");
    expect(result.current.page).toBe(0);
  });

  it("setFilter actualiza solo la clave especificada y resetea página", () => {
    const { result } = renderHook(
      () => useListPageState({ estado: "todos", cliente: "todos" }),
      { wrapper },
    );
    act(() => result.current.setPage(2));
    act(() => result.current.setFilter("estado", "Aceptada"));
    expect(result.current.filters).toEqual({ estado: "Aceptada", cliente: "todos" });
    expect(result.current.page).toBe(0);
  });

  it("paginate corta el array y calcula totalPages", () => {
    const { result } = renderHook(() => useListPageState({}, 5), { wrapper });
    const items = Array.from({ length: 12 }, (_, i) => i);
    const p1 = result.current.paginate(items);
    expect(p1.items).toEqual([0, 1, 2, 3, 4]);
    expect(p1.totalPages).toBe(3);
    act(() => result.current.setPage(2));
    const p3 = result.current.paginate(items);
    expect(p3.items).toEqual([10, 11]);
  });

  it("paginate devuelve totalPages>=1 incluso para arrays vacíos", () => {
    const { result } = renderHook(() => useListPageState({}), { wrapper });
    expect(result.current.paginate([]).totalPages).toBe(1);
  });
});
