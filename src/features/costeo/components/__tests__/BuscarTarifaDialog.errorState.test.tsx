/**
 * Q-03: verifica que el estado de error y el empty-state ("No hay tarifas
 * vigentes") sean mutuamente excluyentes en el modal Top 3.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/features/catalogos/hooks", () => ({
  usePuertos: () => ({
    data: [
      { id: "11111111-1111-1111-1111-111111111111", name: "Shanghai", country: "CN", code: "CNSHA" },
      { id: "22222222-2222-2222-2222-222222222222", name: "Manzanillo", country: "MX", code: "MXZLO" },
    ],
  }),
  useTiposContenedor: () => ({
    data: [{ id: "33333333-3333-3333-3333-333333333333", name: "40HC" }],
  }),
}));

const useTopTarifasMock = vi.fn();
vi.mock("@/features/costeo/hooks/useTopTarifas", () => ({
  useTopTarifas: (...args: unknown[]) => useTopTarifasMock(...args),
}));

import { BuscarTarifaDialog } from "../BuscarTarifaDialog";
import { createWrapper } from "@/test/utils/queryWrapper";

const initial = {
  puertoOrigenId: "11111111-1111-1111-1111-111111111111",
  puertoDestinoId: "22222222-2222-2222-2222-222222222222",
  tipoContenedorId: "33333333-3333-3333-3333-333333333333",
};

beforeEach(() => {
  useTopTarifasMock.mockReset();
});

describe("BuscarTarifaDialog — estado error vs empty-state excluyente", () => {
  it("muestra sólo el estado de error cuando la query falla (no el empty-state)", () => {
    useTopTarifasMock.mockReturnValue({
      data: [],
      isFetching: false,
      error: new Error("Falla de red"),
      refetch: vi.fn(),
      isRefetching: false,
    });
    render(<BuscarTarifaDialog open onOpenChange={() => {}} initial={initial} />, { wrapper: createWrapper() });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("No pudimos cargar la información")).toBeInTheDocument();
    expect(screen.queryByText(/No hay tarifas vigentes/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });

  it("muestra sólo el empty-state cuando no hay error y no hay resultados", () => {
    useTopTarifasMock.mockReturnValue({
      data: [],
      isFetching: false,
      error: null,
      refetch: vi.fn(),
      isRefetching: false,
    });
    render(<BuscarTarifaDialog open onOpenChange={() => {}} initial={initial} />, { wrapper: createWrapper() });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText(/No hay tarifas vigentes/i)).toBeInTheDocument();
  });

  it("el botón Reintentar invoca refetch", () => {
    const refetch = vi.fn();
    useTopTarifasMock.mockReturnValue({
      data: [],
      isFetching: false,
      error: new Error("Falla de red"),
      refetch,
      isRefetching: false,
    });
    render(<BuscarTarifaDialog open onOpenChange={() => {}} initial={initial} />, { wrapper: createWrapper() });
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalled();
  });
});
