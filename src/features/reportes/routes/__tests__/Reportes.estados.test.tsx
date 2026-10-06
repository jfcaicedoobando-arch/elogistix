/**
 * Reportes: error excluye skeleton/vacío/contenido y ofrece retry.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";

const { mockCtrl } = vi.hoisted(() => ({ mockCtrl: vi.fn() }));

vi.mock("@/features/reportes/hooks/useReportesPageController", () => ({
  useReportesPageController: mockCtrl,
}));
vi.mock("@/features/reportes/components/ReportesFiltros", () => ({ default: () => null }));
vi.mock("@/features/reportes/components/ReportesKpiCards", () => ({
  default: () => <div data-testid="kpis" />,
}));
vi.mock("@/features/reportes/components/ReportesTablaClientes", () => ({
  default: () => <div data-testid="tabla" />,
}));
vi.mock("@/features/reportes/components/ReportesTopChart", () => ({
  default: () => <div data-testid="chart" />,
}));

import Reportes from "../Reportes";
import { AVISO_RENTABILIDAD, DESCRIPCION_RENTABILIDAD, AYUDA_CAMBIARIA_RENTABILIDAD } from "@/types/rentabilidad";

const BASE = {
  fechaDesde: "2026-09-01",
  fechaHasta: "2026-09-30",
  modo: "todos",
  setFechaDesde: vi.fn(),
  setFechaHasta: vi.fn(),
  setModo: vi.fn(),
  kpis: { venta: 0, costo: 0, utilidad: 0, margen: 0 },
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
  sorted: [],
  top10: [],
  sortField: "utilidad",
  sortDir: "desc",
  handleSort: vi.fn(),
  handleExport: vi.fn(),
  handleExportPdf: vi.fn(),
  isExportingPdf: false,
  canExport: true,
};

const renderPage = () =>
  render(
    <MemoryRouter>
      <Reportes />
    </MemoryRouter>,
  );

beforeEach(() => vi.clearAllMocks());

describe("Reportes — ramas excluyentes", () => {
  it("shows methodology and warning outside the clamped description, with the real monthly-close link", () => {
    mockCtrl.mockReturnValue(BASE);
    renderPage();
    for (const copy of [DESCRIPCION_RENTABILIDAD, AVISO_RENTABILIDAD]) {
      expect(screen.getByText(copy).closest('.line-clamp-2')).toBeNull();
    }
    expect(screen.getByRole('link', { name: 'Ver proyección y pendiente de facturar en Cierre mensual' })).toHaveAttribute('href', '/reportes/cierre-mensual');
    expect(screen.getByText(AYUDA_CAMBIARIA_RENTABILIDAD).closest('details')).toBeInTheDocument();
  });

  it("error: sólo estado de error, sin KPIs ni tabla", () => {
    const retry = vi.fn();
    mockCtrl.mockReturnValue({ ...BASE, isError: true, refetch: retry });
    renderPage();
    expect(screen.getByText(/no se pudo cargar la rentabilidad/i)).toBeInTheDocument();
    expect(screen.queryByTestId("kpis")).not.toBeInTheDocument();
    expect(screen.queryByTestId("tabla")).not.toBeInTheDocument();
    screen.getByRole("button", { name: /reintentar/i }).click();
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("loading: contenido con skeletons y sin estado de error", async () => {
    mockCtrl.mockReturnValue({ ...BASE, isLoading: true });
    renderPage();
    expect(screen.queryByText(/no se pudo cargar/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("kpis")).toBeInTheDocument();
    await screen.findByTestId("chart");
  });

  it("data: contenido visible", () => {
    mockCtrl.mockReturnValue(BASE);
    renderPage();
    expect(screen.getByTestId("tabla")).toBeInTheDocument();
    expect(screen.queryByText(/no se pudo cargar/i)).not.toBeInTheDocument();
  });
});
