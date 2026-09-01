/**
 * Máquina de estados de la pantalla CxP: un error de carga dejaba `data` en []
 * y montaba el empty state, así que el usuario no tenía "Reintentar".
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { FacturaCxP } from "@/features/cxp/services";

const { mockFacturas, mockPageState, mockRefetch } = vi.hoisted(() => ({
  mockFacturas: vi.fn(),
  mockPageState: vi.fn(),
  mockRefetch: vi.fn(),
}));

vi.mock("@/features/cxp/hooks", () => ({
  useFacturasCxP: mockFacturas,
  useCxpPageState: mockPageState,
  useEliminarFacturaProveedor: () => ({ isPending: false, mutateAsync: vi.fn() }),
  useCxpDeepLinks: () => undefined,
}));
vi.mock("@/hooks/shared", () => ({
  usePermissions: () => ({ canCapturarFacturaProveedor: true }),
  useColumnVisibility: () => ({
    visibility: {}, toggle: vi.fn(), reset: vi.fn(), isCustom: false, setVisibility: vi.fn(),
  }),
  useDocumentTitle: () => undefined,
}));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/components/shared/dataTable/ResponsiveDataTable", () => ({
  ResponsiveDataTable: (props: { isLoading?: boolean }) => (
    <div data-testid="tabla">{props.isLoading ? "cargando" : "listo"}</div>
  ),
}));
vi.mock("@/features/cxp/routes/_sections/CxpRouteDialogs", () => ({ CxpRouteDialogs: () => null }));
vi.mock("@/features/cxp/components/CxpFiltros", () => ({ CxpFiltros: () => null }));
vi.mock("@/features/cxp/components/CxpKpiCards", () => ({
  CxpKpiCards: () => <div data-testid="kpis" />,
}));
vi.mock("@/features/cxp/components/CxpEmptyState", () => ({
  CxpEmptyState: () => <div data-testid="empty-cxp" />,
}));

import Cxp from "../Cxp";

const KPIS = {
  por_pagar_mxn: 0, por_pagar_usd: 0, vencido_mxn: 0, vencido_usd: 0,
  por_vencer_7d_mxn: 0, por_vencer_7d_usd: 0, facturas_vencidas: 0,
};

function estado(hayFiltros: boolean) {
  return {
    search: "", setSearch: vi.fn(), debouncedSearch: "", page: 0, setPage: vi.fn(), pageSize: 100,
    estatus: "todos", setEstatus: vi.fn(), moneda: "todas", setMoneda: vi.fn(),
    origen: "todos", setOrigen: vi.fn(), aprobacion: "todos", setAprobacion: vi.fn(),
    proveedorId: "todos", setProveedorId: vi.fn(),
    categoriaPresupuestoId: "todas", setCategoriaPresupuestoId: vi.fn(),
    fechaDesde: "", setFechaDesde: vi.fn(), fechaHasta: "", setFechaHasta: vi.fn(),
    hayFiltros, queryArgs: {},
    openNueva: false, setOpenNueva: vi.fn(), pagar: null, setPagar: vi.fn(),
    detalle: null, setDetalle: vi.fn(), editar: null, setEditar: vi.fn(),
    aEliminar: null, setAEliminar: vi.fn(),
  };
}

function factura(): FacturaCxP {
  return { id: "f1", folio_interno: "FI-1", moneda: "MXN", saldo: 100 } as FacturaCxP;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPageState.mockReturnValue(estado(false));
});

describe("Cxp — estados excluyentes", () => {
  it("error con data vacía y sin filtros muestra error con Reintentar, no el empty", async () => {
    mockFacturas.mockReturnValue({
      data: [], isLoading: false, isError: true, refetch: mockRefetch, kpis: KPIS,
    });
    render(<Cxp />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByTestId("empty-cxp")).not.toBeInTheDocument();
    expect(screen.queryByTestId("tabla")).not.toBeInTheDocument();
    expect(screen.queryByTestId("kpis")).not.toBeInTheDocument();
    screen.getByRole("button", { name: /reintentar/i }).click();
    expect(mockRefetch).toHaveBeenCalled();
  });

  it("loading muestra la tabla en carga, no el empty ni el error", () => {
    mockFacturas.mockReturnValue({
      data: [], isLoading: true, isError: false, refetch: mockRefetch, kpis: KPIS,
    });
    render(<Cxp />);
    expect(screen.getByTestId("tabla").textContent).toBe("cargando");
    expect(screen.queryByTestId("empty-cxp")).not.toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("cero filas real sin filtros conserva el empty de CxP", () => {
    mockFacturas.mockReturnValue({
      data: [], isLoading: false, isError: false, refetch: mockRefetch, kpis: KPIS,
    });
    render(<Cxp />);
    expect(screen.getByTestId("empty-cxp")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("cero filas con filtros activos conserva el empty de la tabla", () => {
    mockPageState.mockReturnValue(estado(true));
    mockFacturas.mockReturnValue({
      data: [], isLoading: false, isError: false, refetch: mockRefetch, kpis: KPIS,
    });
    render(<Cxp />);
    expect(screen.getByTestId("tabla")).toBeInTheDocument();
    expect(screen.queryByTestId("empty-cxp")).not.toBeInTheDocument();
  });

  it("con datos muestra la tabla", () => {
    mockFacturas.mockReturnValue({
      data: [factura()], isLoading: false, isError: false, refetch: mockRefetch, kpis: KPIS,
    });
    render(<Cxp />);
    expect(screen.getByTestId("tabla").textContent).toBe("listo");
    expect(screen.getByTestId("kpis")).toBeInTheDocument();
  });
});
