import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { withNuqsTestingAdapter } from "nuqs/adapters/testing";
import { MemoryRouter } from "react-router";
import type { ReactNode } from "react";
import CxcAging from "../CxcAging";
import CxpAging from "@/features/cxp/routes/CxpAging";

const { csv, cxc, cxp } = vi.hoisted(() => ({ csv: vi.fn(), cxc: vi.fn(), cxp: vi.fn() }));
vi.mock("@/lib/ui/notifyCsvExport", () => ({ downloadCsvWithFeedback: csv }));
vi.mock("@/lib/date/today", () => ({ todayLocalISO: () => "2026-11-04" }));
vi.mock("@/features/cxc/hooks/useCxcAging", () => ({ useCxcAging: cxc }));
vi.mock("@/features/cxp/hooks/useCxpAging", () => ({ useCxpAging: cxp }));
vi.mock("@/features/cxc/components/cxcAgingColumns", () => ({ buildCxcAgingColumns: () => [] }));
vi.mock("@/features/cxp/components/cxpAgingColumns", () => ({ buildCxpAgingColumns: () => [] }));
vi.mock("@/features/cxc/components/CxcAgingDrillDownDialog", () => ({ CxcAgingDrillDownDialog: () => null }));
vi.mock("@/features/cxp/components/AgingDrillDownDialog", () => ({ AgingDrillDownDialog: () => null }));
vi.mock("@/components/shared/filters/UnifiedFiltersBar", () => ({ UnifiedFiltersBar: () => null }));
vi.mock("@/components/shared/dataTable/ResponsiveDataTable", () => ({
  ResponsiveDataTable: ({ data }: { data: { cliente_nombre?: string; proveedor_nombre?: string }[] }) => <div data-testid="tabla">{data.map((f, i) => <p key={i}>{f.cliente_nombre ?? f.proveedor_nombre}</p>)}</div>,
}));

const base = { moneda: "MXN", saldo_total: 116.04, vigente: 0, d_1_30: 0, d_31_60: 116.04, d_61_90: 0, mas_90: 0, num_facturas: 3 };
const rows = [
  { ...base, id: "a1", nombre: "Alfa Norte" },
  { ...base, id: "a2", nombre: "Alfa Sur" },
  { ...base, id: "a3", nombre: "Alfa Vigente", vigente: 116.04, d_31_60: 0 },
  { ...base, id: "b", nombre: "Beta" },
];
const queryState = { isLoading: false, isError: false, error: null, refetch: vi.fn(), monedas: ["MXN", "USD"], monedaActiva: "MXN", setMoneda: vi.fn(), totales: { ...base, total: 464.16 } };

beforeEach(() => {
  vi.clearAllMocks();
  cxc.mockReturnValue({ ...queryState, rowsFiltradas: rows.map(r => ({ ...r, cliente_id: r.id, cliente_nombre: r.nombre })) });
  cxp.mockReturnValue({ ...queryState, rowsFiltradas: rows.map(r => ({ ...r, proveedor_id: r.id, proveedor_nombre: r.nombre })) });
});

function wrapper(query: string) {
  const Nuqs = withNuqsTestingAdapter({ hasMemory: true, searchParams: query });
  return ({ children }: { children: ReactNode }) => <Nuqs><MemoryRouter>{children}</MemoryRouter></Nuqs>;
}

describe.each([["CxC", CxcAging], ["CxP", CxpAging]] as const)("CSV Aging %s respeta tabla", (_, Route) => {
  it("exporta todas las páginas que combinan búsqueda y cubeta e identifica su alcance", () => {
    render(<Route />, { wrapper: wrapper("?q=Alfa&cubeta=31_60&ps=1&page=1") });
    expect(screen.getByTestId("tabla").querySelectorAll("p")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Exportar CSV" }));
    expect(csv).toHaveBeenCalledWith(expect.objectContaining({ rowCount: 2 }));
    const content: string = csv.mock.lastCall?.[0].csv;
    expect(content).toContain("Alfa Norte");
    expect(content).toContain("Alfa Sur");
    expect(content).not.toContain("Alfa Vigente");
    expect(content).not.toContain("Beta");
    expect(content).toContain("Con saldo en 31-60 días; Búsqueda: Alfa");
    expect(content).toContain("Todas las filas filtradas (sin paginación)");
    expect(content).toContain("2026-11-04");
    expect(screen.getByText(/en todas las páginas/)).toBeInTheDocument();
  });

  it("+90 sin resultados impide exportar deuda de31–60", () => {
    render(<Route />, { wrapper: wrapper("?cubeta=mas_90") });
    const button = screen.getByRole("button", { name: "Exportar CSV" });
    expect(button).toBeDisabled();
    expect(screen.getByTestId("tabla").querySelectorAll("p")).toHaveLength(0);
    fireEvent.click(button);
    expect(csv).not.toHaveBeenCalled();
  });
});
