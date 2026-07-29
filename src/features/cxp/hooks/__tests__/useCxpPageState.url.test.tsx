/**
 * M10 — Filtros de CxP en la URL (nuqs).
 *
 * Verifica que la URL inicializa los filtros (deep link `?aprobacion=` sin
 * efecto mount-only) y que cambiar un filtro resetea la página.
 */
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { ReactNode } from "react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import { useCxpPageState } from "../useCxpPageState";

function wrapperConUrl(searchParams: string) {
  return ({ children }: { children: ReactNode }) => (
    <NuqsTestingAdapter searchParams={searchParams}>{children}</NuqsTestingAdapter>
  );
}

describe("useCxpPageState — filtros en URL", () => {
  it("inicializa los filtros desde la query string", () => {
    const { result } = renderHook(() => useCxpPageState(), {
      wrapper: wrapperConUrl("?q=abc&estatus=Pagada&aprobacion=pendiente&from=2026-01-01&page=2"),
    });
    expect(result.current.search).toBe("abc");
    expect(result.current.estatus).toBe("Pagada");
    expect(result.current.aprobacion).toBe("pendiente");
    expect(result.current.fechaDesde).toBe("2026-01-01");
    expect(result.current.page).toBe(2);
    expect(result.current.hayFiltros).toBe(true);
  });

  it("defaults limpios cuando la URL no trae filtros", () => {
    const { result } = renderHook(() => useCxpPageState(), { wrapper: wrapperConUrl("") });
    expect(result.current.hayFiltros).toBe(false);
    expect(result.current.aprobacion).toBe("todos");
    expect(result.current.page).toBe(0);
  });

  it("cambiar un filtro regresa a la primera página", async () => {
    const { result } = renderHook(() => useCxpPageState(), {
      wrapper: wrapperConUrl("?page=3"),
    });
    expect(result.current.page).toBe(3);
    await act(async () => {
      result.current.setAprobacion("pendiente");
    });
    expect(result.current.page).toBe(0);
    expect(result.current.aprobacion).toBe("pendiente");
  });
});
