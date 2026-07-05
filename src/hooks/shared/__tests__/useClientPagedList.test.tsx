import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { NuqsAdapter } from "nuqs/adapters/react";
import { MemoryRouter } from "react-router-dom";
import type { PropsWithChildren } from "react";
import { useClientPagedList } from "@/hooks/shared/useClientPagedList";

function wrapper({ children }: PropsWithChildren) {
  return (
    <MemoryRouter>
      <NuqsAdapter>{children}</NuqsAdapter>
    </MemoryRouter>
  );
}

interface Row {
  id: string;
  nombre: string;
  monto: number;
  moneda: string;
  fecha: string;
}

const DATA: Row[] = [
  { id: "1", nombre: "Alfa",    monto: 100, moneda: "MXN", fecha: "2026-01-15" },
  { id: "2", nombre: "Beta",    monto: 200, moneda: "USD", fecha: "2026-03-10" },
  { id: "3", nombre: "Gamma",   monto:  50, moneda: "MXN", fecha: "2026-05-01" },
  { id: "4", nombre: "Delta",   monto: 300, moneda: "USD", fecha: "2026-07-20" },
  { id: "5", nombre: "Epsilon", monto: 150, moneda: "MXN", fecha: "2026-09-30" },
];

interface Filters extends Record<string, string> { moneda: string }
const DEFAULTS: Filters = { moneda: "todas" };

function setup(data: Row[] = DATA) {
  return renderHook(
    () =>
      useClientPagedList<Row, Filters>({
        data,
        defaultFilters: DEFAULTS,
        defaultPageSize: 2,
        filterLabels: { moneda: "Moneda" },
        searchAccessor: (r) => r.nombre,
        filterPredicate: (r, ff) => ff.moneda === "todas" || r.moneda === ff.moneda,
        dateAccessor: (r) => r.fecha,
        sorters: {
          nombre: (a, b) => a.nombre.localeCompare(b.nombre),
          monto: (a, b) => a.monto - b.monto,
        },
        defaultSort: { key: "nombre", dir: "asc" },
      }),
    { wrapper },
  );
}

describe("useClientPagedList", () => {
  it("aplica default sort ascendente y pagina", () => {
    const { result } = setup();
    expect(result.current.rows.map((r) => r.nombre)).toEqual(["Alfa", "Beta"]);
    expect(result.current.filteredCount).toBe(5);
    expect(result.current.totalPages).toBe(3);
    expect(result.current.pagination.page).toBe(0);
  });

  it("filtra por search en el accessor", async () => {
    const { result } = setup();
    await act(async () => result.current.setSearch("gam"));
    expect(result.current.rows).toHaveLength(1);
    expect(result.current.rows[0].nombre).toBe("Gamma");
  });

  it("filtra por filtro custom y genera chip", async () => {
    const { result } = setup();
    await act(async () => result.current.setFilter("moneda", "USD"));
    expect(result.current.filteredCount).toBe(2);
    expect(result.current.rows.map((r) => r.nombre)).toEqual(["Beta", "Delta"]);
    expect(result.current.activeChips).toHaveLength(1);
    expect(result.current.activeChips[0].label).toContain("USD");
  });

  it("aplica rango de fechas", async () => {
    const { result } = setup();
    await act(async () => result.current.setDateFrom("2026-04-01"));
    await act(async () => result.current.setDateTo("2026-08-31"));
    expect(result.current.filteredCount).toBe(2);
    expect(result.current.rows.map((r) => r.nombre).sort()).toEqual(["Delta", "Gamma"]);
  });

  it("cambia orden a descendente por columna", async () => {
    const { result } = setup();
    await act(async () => result.current.setSort("monto", "desc"));
    expect(result.current.rows.map((r) => r.monto)).toEqual([300, 200]);
    expect(result.current.sortKey).toBe("monto");
    expect(result.current.sortDir).toBe("desc");
  });

  it("resetAll limpia búsqueda, filtros, fechas y regresa a página 0", async () => {
    const { result } = setup();
    await act(async () => result.current.setSearch("beta"));
    await act(async () => result.current.setFilter("moneda", "USD"));
    await act(async () => result.current.setPage(1));
    await act(async () => result.current.resetAll());
    expect(result.current.search).toBe("");
    expect(result.current.filters.moneda).toBe("todas");
    expect(result.current.page).toBe(0);
    expect(result.current.filteredCount).toBe(5);
  });

  it("paginación: pageSize y total pages responden a cambios", async () => {
    const { result } = setup();
    await act(async () => result.current.setPageSize(5));
    expect(result.current.totalPages).toBe(1);
    expect(result.current.rows).toHaveLength(5);
  });

  it("no crashea con data undefined", () => {
    const { result } = renderHook(
      () =>
        useClientPagedList<Row, Filters>({
          data: undefined,
          defaultFilters: DEFAULTS,
          searchAccessor: (r) => r.nombre,
        }),
      { wrapper },
    );
    expect(result.current.rows).toEqual([]);
    expect(result.current.filteredCount).toBe(0);
  });
});
