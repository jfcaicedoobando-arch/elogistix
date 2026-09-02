/**
 * v13.823.49 — En desktop, abrir el colapsable de filtros NO debe abrir además
 * el sheet móvil (antes compartían estado y salían dos paneles con dos botones
 * "Limpiar").
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import OportunidadesFiltersSection from "@/features/crm/components/OportunidadesFiltersSection";
import { FILTROS_DEFAULT } from "@/features/crm/components/oportunidadesFiltersTypes";

vi.mock("@/hooks/shared/useIsMobile", () => ({ useIsMobile: () => false }));
vi.mock("@/components/shared/MobileFiltersSheet", () => ({
  MobileFiltersSheet: () => <div data-testid="mobile-sheet" />,
}));
vi.mock("@/features/crm/components/OportunidadesFiltersBar", () => ({
  default: () => <div data-testid="filters-bar" />,
}));
vi.mock("@/features/crm/components/OportunidadesViewChips", () => ({
  default: () => <div data-testid="view-chips" />,
}));

const baseProps = {
  search: "",
  onSearchChange: vi.fn(),
  filtros: FILTROS_DEFAULT,
  onFiltrosChange: vi.fn(),
  onFiltersOpenChange: vi.fn(),
  etapas: [],
  vendedores: [],
  activos: 0,
};

describe("OportunidadesFiltersSection", () => {
  it("con filtros abiertos en desktop no monta el sheet móvil", () => {
    render(<OportunidadesFiltersSection {...baseProps} filtersOpen />);
    expect(screen.queryByTestId("mobile-sheet")).toBeNull();
    expect(screen.getAllByTestId("filters-bar")).toHaveLength(1);
  });

  it("con filtros cerrados no muestra ningún panel", () => {
    render(<OportunidadesFiltersSection {...baseProps} filtersOpen={false} />);
    expect(screen.queryByTestId("filters-bar")).toBeNull();
    expect(screen.queryByText(/Limpiar filtros/i)).toBeNull();
  });

  it("muestra un solo botón Limpiar cuando hay filtros activos", () => {
    render(<OportunidadesFiltersSection {...baseProps} filtersOpen activos={2} />);
    expect(screen.getAllByText(/Limpiar filtros/i)).toHaveLength(1);
  });
});
