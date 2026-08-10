import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { MemoryRouter } from "react-router-dom";
import { useTableFilters } from "@/hooks/shared/useTableFilters";
import type { PropsWithChildren } from "react";

const NuqsWrapper = withNuqsTestingAdapter();

function wrapper({ children }: PropsWithChildren) {
  return (
    <MemoryRouter>
      <NuqsWrapper>{children}</NuqsWrapper>
    </MemoryRouter>
  );
}

describe("useTableFilters", () => {
  it("aplica default filters y sin chips", () => {
    const { result } = renderHook(
      () =>
        useTableFilters({
          defaultFilters: { estado: "todos", cliente: "todos" },
          filterLabels: { estado: "Estado", cliente: "Cliente" },
        }),
      { wrapper },
    );
    expect(result.current.filters.estado).toBe("todos");
    expect(result.current.activeChips).toHaveLength(0);
    expect(result.current.activeCount).toBe(0);
  });

  it("añade chip cuando cambia un filtro y lo remueve al llamar onRemove", async () => {
    const { result } = renderHook(
      () =>
        useTableFilters({
          defaultFilters: { estado: "todos" },
          filterLabels: { estado: "Estado" },
        }),
      { wrapper },
    );
    await act(async () => result.current.setFilter("estado", "Pagada"));
    expect(result.current.activeChips).toHaveLength(1);
    expect(result.current.activeChips[0].label).toContain("Pagada");
    await act(async () => result.current.activeChips[0].onRemove());
    expect(result.current.activeChips).toHaveLength(0);
  });

  it("isInRange filtra por fecha", async () => {
    const { result } = renderHook(
      () => useTableFilters({ defaultFilters: {} as Record<string, string> }),
      { wrapper },
    );
    // El adaptador de pruebas de nuqs no conserva la URL entre flushes, así
    // que ambos extremos del rango se aplican en el mismo batch.
    await act(async () => {
      result.current.setDateFrom("2026-01-01");
      result.current.setDateTo("2026-12-31");
    });
    expect(result.current.isInRange("2026-06-15")).toBe(true);
    expect(result.current.isInRange("2025-12-31")).toBe(false);
    expect(result.current.activeChips).toHaveLength(2);
  });

  it("resetAll limpia todo", async () => {
    const { result } = renderHook(
      () =>
        useTableFilters({
          defaultFilters: { estado: "todos" },
        }),
      { wrapper },
    );
    await act(async () => {
      result.current.setFilter("estado", "Pagada");
      result.current.setSearch("abc");
      result.current.setDateFrom("2026-01-01");
    });
    await act(async () => result.current.resetAll());
    expect(result.current.filters.estado).toBe("todos");
    expect(result.current.search).toBe("");
    expect(result.current.dateFrom).toBe("");
  });
});
