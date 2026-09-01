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
  hero: {
    utilidad_mxn: 1, venta_mxn: 2, costo_mxn: 1, margen_pct: 50, margen_pct_prev: 40,
    cartera_vencida_mxn: 0, cartera_vencida_clientes: 0, facturado_mes_mxn: 0,
  },
  margen_6m: [],
  margen_por_modo: [],
  antiguedad: [],
  top_clientes: [],
  pulso: {
    embarques_activos: 0, embarques_por_estado: [], arribos_7d: 0, demoras: 0,
    documentos_vencidos: null, cfdi_timbrados_mes: 0, acuses_pendientes: 0,
  },
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
