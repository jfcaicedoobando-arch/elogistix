/**
 * v13.823.278 — En /proformas la casilla de selección y la acción
 * "Fusionar / Convertir a factura" son escritura fiscal: sólo se muestran a
 * quien puede emitir facturas (admin/contador). Vendedor y gerente comercial
 * consultan en modo lectura, sin casillas que terminaban en un botón
 * deshabilitado. El guard del backend no cambia.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const permisos = { canEmitirFactura: true };
vi.mock("@/hooks/shared", () => ({ usePermissions: () => permisos }));

const buildColumnsSpy = vi.fn((_args: Record<string, unknown>) => []);
vi.mock("../proformasColumns", () => ({
  buildProformasColumns: (args: Record<string, unknown>) => buildColumnsSpy(args),
}));

vi.mock("@/components/shared/dataTable/ResponsiveDataTable", () => ({
  ResponsiveDataTable: () => <div data-testid="tabla" />,
}));
vi.mock("../ProformasFiltros", () => ({ default: () => <div /> }));
vi.mock("@/features/proformas/hooks/useConvertirProformaDirecto", () => ({
  useConvertirProformaDirecto: () => ({ convertir: vi.fn(), isPending: false }),
}));

const proforma = { id: "p1", numero: "PRO-1" };

const controller = {
  isLoading: false,
  isError: false,
  refetch: vi.fn(),
  search: "",
  setSearch: vi.fn(),
  filtroEstado: "todas",
  setFiltroEstado: vi.fn(),
  filtroCliente: "todos",
  setFiltroCliente: vi.fn(),
  filtroOperador: "todos",
  setFiltroOperador: vi.fn(),
  fechaDesde: "",
  setFechaDesde: vi.fn(),
  fechaHasta: "",
  setFechaHasta: vi.fn(),
  clientesDisponibles: [],
  operadoresDisponibles: [],
  clearFiltros: vi.fn(),
  filtered: [proforma],
  paginated: [proforma],
  counts: { todas: 1 },
  csvColumns: [],
  csvRows: () => [],
  selectedIds: new Set(["p1"]),
  toggleSelected: vi.fn(),
  isConvertible: () => true,
  selectedProformas: [proforma],
  clearSelected: vi.fn(),
  fusionInfo: { sameCliente: true, clienteNombre: "ACME", organizationId: "o1", diasCredito: 30 },
  page: 0,
  totalPages: 1,
  setPage: vi.fn(),
  pageSize: 50,
  setPageSize: vi.fn(),
};

vi.mock("@/features/facturacion/hooks", () => ({
  useTabProformasController: () => controller,
}));

const { TabProformas } = await import("../TabProformas");

describe("TabProformas — selección según permiso de emisión", () => {
  beforeEach(() => {
    buildColumnsSpy.mockClear();
    permisos.canEmitirFactura = true;
  });

  it("contador/operador con emisión: incluye la casilla de selección y la acción", () => {
    render(<TabProformas />);
    expect(buildColumnsSpy.mock.calls[0][0]).toHaveProperty("selection");
    expect(screen.getByRole("button", { name: /convertir a factura/i })).toBeInTheDocument();
  });

  it("vendedor / gerente comercial: sin casilla de selección ni acción de convertir", () => {
    permisos.canEmitirFactura = false;
    render(<TabProformas />);
    expect(buildColumnsSpy.mock.calls[0][0]).not.toHaveProperty("selection");
    expect(screen.queryByRole("button", { name: /convertir a factura/i })).toBeNull();
    expect(screen.queryByRole("button", { name: /fusionar/i })).toBeNull();
  });
});
