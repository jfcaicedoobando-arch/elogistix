/**
 * Dirección: loading → error → empty → data como ramas mutuamente
 * excluyentes. En error no debe verse skeleton ni contenido viejo.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const { mockKpis, mockTotales } = vi.hoisted(() => ({ mockKpis: vi.fn(), mockTotales: vi.fn() }));

vi.mock("@/features/dashboard/direccion/hooks/useDireccionKpis", () => ({ useDireccionKpis: mockKpis }));
vi.mock("@/features/dashboard/direccion/hooks/useDireccionTotales", () => ({
  useDireccionTotales: mockTotales,
}));
vi.mock("@/features/dashboard/direccion/components/TipoCambioFallbackBanner", () => ({
  TipoCambioFallbackBanner: () => null,
}));

import DireccionDashboard from "../DireccionDashboard";

const DATA = {
  hero: { utilidad_mxn: 1, cartera_mxn: 2, meta_pct: 3 },
  margen_6m: [],
  margen_por_modo: [],
  antiguedad: { buckets: [] },
  top_clientes: [],
  pulso: { embarques_mes: 0 },
};

function renderPage() {
  return render(
    <MemoryRouter>
      <DireccionDashboard />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockTotales.mockReturnValue({ data: undefined, isLoading: false, desdeIso: "2026-09-01" });
});

describe("DireccionDashboard — una sola rama", () => {
  it("loading: skeleton y nada más", () => {
    mockKpis.mockReturnValue({ data: undefined, isLoading: true, error: null, refetch: vi.fn() });
    renderPage();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText(/rentabilidad/i)).not.toBeInTheDocument();
  });

  it("error: alerta con retry, sin skeleton ni secciones de datos", () => {
    const retry = vi.fn();
    mockKpis.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error("KPIs caídos"),
      refetch: retry,
    });
    renderPage();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("KPIs caídos")).toBeInTheDocument();
    expect(screen.queryByText(/rentabilidad/i)).not.toBeInTheDocument();
    screen.getByRole("button", { name: /reintentar/i }).click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("sin datos: estado vacío, no skeleton ni error destructivo", () => {
    mockKpis.mockReturnValue({ data: undefined, isLoading: false, error: null, refetch: vi.fn() });
    renderPage();
    expect(screen.getByText(/sin información/i)).toBeInTheDocument();
    expect(screen.queryByText(/rentabilidad/i)).not.toBeInTheDocument();
  });

  it("data: secciones visibles y ninguna alerta", () => {
    mockKpis.mockReturnValue({ data: DATA, isLoading: false, error: null, refetch: vi.fn() });
    renderPage();
    expect(screen.getByText(/rentabilidad/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
