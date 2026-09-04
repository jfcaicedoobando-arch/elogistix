/**
 * El botón/lámina "Filtros" no debe aparecer en escritorio cuando no hay
 * filtros `secondary`: abría un Sheet vacío (sólo Limpiar/Aplicar).
 * En móvil sí se conserva, porque `primary` vive dentro del panel.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockIsMobile = vi.fn(() => false);
vi.mock("@/hooks/shared", () => ({ useIsMobile: () => mockIsMobile() }));

import { UnifiedFiltersBar } from "../UnifiedFiltersBar";

const base = {
  search: "",
  onSearchChange: vi.fn(),
  chips: [],
  activeCount: 0,
  onClearAll: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsMobile.mockReturnValue(false);
});

describe("UnifiedFiltersBar · panel de filtros", () => {
  it("escritorio con primary y sin secondary no muestra el botón Filtros", () => {
    render(<UnifiedFiltersBar {...base} primary={<button type="button">Estado</button>} />);
    expect(screen.queryByRole("button", { name: /filtros/i })).toBeNull();
    expect(screen.getByRole("button", { name: "Estado" })).toBeInTheDocument();
  });

  it("escritorio con secondary sí muestra el botón Filtros", () => {
    render(<UnifiedFiltersBar {...base} secondary={<button type="button">Moneda</button>} />);
    expect(screen.getByRole("button", { name: /filtros/i })).toBeInTheDocument();
  });

  it("móvil con sólo primary permite abrir el panel con esos filtros", async () => {
    mockIsMobile.mockReturnValue(true);
    render(<UnifiedFiltersBar {...base} primary={<button type="button">Estado</button>} />);

    const trigger = screen.getByRole("button", { name: /filtros/i });
    trigger.click();
    expect(await screen.findByRole("button", { name: "Estado" })).toBeInTheDocument();
  });
});
