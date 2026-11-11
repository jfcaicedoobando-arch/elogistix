import { describe, it, expect, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type { FacturasEmitidasFiltros, FacturasEmitidasTabla } from "../facturasEmitidasProps";
import type { Factura } from "../../routes/facturacionColumns";
vi.mock("@/hooks/shared", () => ({ usePermissions: () => ({ canEmitirFactura: true }) }));
vi.mock("../../hooks/useFacturasMasivas", () => ({ useFacturasMasivas: () => ({ busy: null, progreso: null, descargarZip: vi.fn(), reenviarEmail: vi.fn(), marcarEnviada: vi.fn() }) }));
vi.mock("../DialogDescargarZipMes", () => ({ DialogDescargarZipMes: () => null }));
vi.mock("../FacturasEmitidasFooter", () => ({ FacturasEmitidasFooter: () => null }));
vi.mock("@/components/shared/filters/UnifiedFiltersBar", () => ({ UnifiedFiltersBar: ({ primary, secondary }: { primary: ReactNode; secondary: ReactNode }) => <>{primary}{secondary}</> }));
vi.mock("@/components/shared/dataTable/ResponsiveDataTable", () => ({ ResponsiveDataTable: ({ data, mobileCard, emptyState }: { data: Factura[]; mobileCard: (row: Factura) => ReactNode; emptyState: ReactNode }) => <>{data.length ? data.map((f) => <div key={f.id}>{mobileCard(f)}</div>) : emptyState}</> }));
import { TabFacturasEmitidas } from "../TabFacturasEmitidas";

const filtros: FacturasEmitidasFiltros = {
  search: "", setSearch: vi.fn(), filterEstado: "todos", filterCliente: "todos", setFilter: vi.fn(),
  fechaDesde: "2026-01-01", setFechaDesde: vi.fn(), fechaHasta: "2026-01-31", setFechaHasta: vi.fn(),
  clientes: [{ id: "ACME", nombre: "ACME" }], onClear: vi.fn(), setPeriodo: vi.fn(),
};
const tabla: FacturasEmitidasTabla = {
  columns: [], data: [], facturasFiltradas: [], totalFacturas: 0, isLoading: false,
  page: 0, totalPages: 1, setPage: vi.fn(), pageSize: 50, setPageSize: vi.fn(),
};
const acciones = { exportarFacturasCsv: vi.fn(), exportarLayoutContable: vi.fn(), onCreateNew: vi.fn() };

describe("Emitidas: contexto y acciones móviles", () => {
  it("identifica alcance temporal/exportación y muestra vacío por filtros, no ausencia de facturas", () => {
    render(<TabFacturasEmitidas filtros={filtros} tabla={tabla} acciones={acciones} />);
    expect(screen.getByRole("combobox", { name: "Período de emisión de facturas" })).toBeInTheDocument();
    expect(screen.getByText(/sólo esta bandeja/)).toBeInTheDocument();
    expect(screen.getByLabelText("Emisión desde")).toBeInTheDocument();
    expect(screen.getByText(/CSV y layout contable incluyen todos/)).toBeInTheDocument();
    expect(screen.getByText("No se encontraron facturas")).toBeInTheDocument();
    expect(screen.queryByText("Aún no hay facturas emitidas")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Marcar enviada" })).not.toBeInTheDocument();
  });

  it("permite seleccionar una tarjeta móvil y acceder a las acciones masivas", () => {
    const factura = { id: "f1", numero: "FAC-1", cliente_nombre: "ACME", moneda: "MXN", total: 116, estado: "Emitida" } as Factura;
    render(<TabFacturasEmitidas filtros={filtros} tabla={{ ...tabla, data: [factura], facturasFiltradas: [factura], totalFacturas: 1 }} acciones={acciones} />);
    const checkbox = screen.getByRole("checkbox", { name: "Seleccionar factura FAC-1" });
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(screen.getByRole("button", { name: "Descargar ZIP" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Reenviar por email" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Marcar enviada" })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: "Limpiar" }));
    expect(checkbox).not.toBeChecked();
    expect(screen.queryByRole("button", { name: "Marcar enviada" })).not.toBeInTheDocument();
  });
});
