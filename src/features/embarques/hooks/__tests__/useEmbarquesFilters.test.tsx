import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { useEmbarquesFilters } from "../useEmbarquesFilters";

const wrapper = withNuqsTestingAdapter({ hasMemory: true });

describe("useEmbarquesFilters", () => {
  it("inicializa con valores por defecto", () => {
    const { result } = renderHook(() => useEmbarquesFilters(), { wrapper });
    expect(result.current.search).toBe("");
    expect(result.current.filters.modo).toBe("todos");
    expect(result.current.page).toBe(0);
  });

  it("actualiza búsqueda y resetea página", async () => {
    const { result } = renderHook(() => useEmbarquesFilters(), { wrapper });
    await act(async () => {
      result.current.setPageRaw(5);
    });
    expect(result.current.page).toBe(5);

    await act(async () => {
      result.current.setSearch("test-query");
    });
    expect(result.current.search).toBe("test-query");
    expect(result.current.page).toBe(0);
  });

  it("actualiza filtro y resetea página", async () => {
    const { result } = renderHook(() => useEmbarquesFilters(), { wrapper });
    await act(async () => {
      result.current.setPageRaw(2);
    });
    
    await act(async () => {
      result.current.setFilter("modo", "Marítimo", "todos");
    });
    
    expect(result.current.filters.modo).toBe("Marítimo");
    expect(result.current.page).toBe(0);
  });
});
