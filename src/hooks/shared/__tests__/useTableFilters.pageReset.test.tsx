import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { MemoryRouter } from "react-router-dom";
import { useTableFilters } from "@/hooks/shared/useTableFilters";
import type { PropsWithChildren } from "react";

const NuqsWrapper = withNuqsTestingAdapter({ searchParams: "?page=4" });

function wrapper({ children }: PropsWithChildren) {
  return (
    <MemoryRouter>
      <NuqsWrapper>{children}</NuqsWrapper>
    </MemoryRouter>
  );
}

describe("useTableFilters · M12 reset de página al cambiar el rango de fechas", () => {
  it("setDateFrom regresa a la primera página", async () => {
    const { result } = renderHook(
      () => useTableFilters({ defaultFilters: {} as Record<string, string> }),
      { wrapper },
    );
    expect(result.current.page).toBe(4);
    await act(async () => result.current.setDateFrom("2026-01-01"));
    expect(result.current.page).toBe(0);
  });

  it("setDateTo regresa a la primera página", async () => {
    const { result } = renderHook(
      () => useTableFilters({ defaultFilters: {} as Record<string, string> }),
      { wrapper },
    );
    await act(async () => result.current.setDateTo("2026-12-31"));
    expect(result.current.page).toBe(0);
  });
});
