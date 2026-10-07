import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import ProfitEstadoResultados from "../ProfitEstadoResultados";
import { useEstadoResultados } from "@/features/profit/hooks/useEstadoResultados";
import { buildEstadoResultados } from "@/features/profit/domain/estadoResultados";
import type { FuenteEERR } from "@/features/profit/domain/fuenteEerr";

vi.mock("@/features/profit/hooks/useEstadoResultados", () => ({ useEstadoResultados: vi.fn() }));
vi.mock("@/features/profit/hooks/useFuenteEerr", () => ({ useFuenteEerr: () => ({ fuente: "facturas", setFuente: vi.fn() }) }));
vi.mock("@/features/catalogos/hooks", () => ({ useExchangeRates: () => ({ data: { esFallback: false } }) }));
vi.mock("@/hooks/shared", () => ({ usePdfExport: () => ({ isExporting: false, run: vi.fn() }) }));
vi.mock("@/generators/exportCsv", () => ({ exportToCsv: vi.fn() }));
vi.mock("@/pdf/render/descargarPdf", () => ({ descargarPdf: vi.fn() }));

const mes = { key: "2026-10", label: "Octubre 2026", year: 2026, month: 10 };
const subtituloOperativo = "P&G mensual por modo de transporte basado en ETA del embarque";
const subtituloDevengado = "P&G mensual por modo de transporte basado en facturas de clientes y proveedores";

function controlador(fuente: FuenteEERR) {
  const c = {
    organizationId: "org-test", mesActual: mes, mesesDisponibles: [mes], setMesKey: vi.fn(), irMesAnterior: vi.fn(), irMesSiguiente: vi.fn(),
    puedeIrAtras: false, puedeIrAdelante: false, data: buildEstadoResultados([], [], []),
    isLoading: false, isError: false, error: null, refetch: vi.fn(), fuente, setFuente: vi.fn(),
  };
  vi.mocked(useEstadoResultados).mockReturnValue(c);
  return c;
}

const pagina = <MemoryRouter><ProfitEstadoResultados /></MemoryRouter>;

describe("EERR: copy según la fuente efectiva del reporte", () => {
  beforeEach(() => vi.clearAllMocks());

  it("describe la fuente devengada y sus fechas sin atribuirle ETA", () => {
    controlador("facturas");
    render(pagina);
    expect(screen.getByText(subtituloDevengado)).toBeVisible();
    expect(screen.queryByText(subtituloOperativo)).not.toBeInTheDocument();
    const aviso = screen.getByText(/Fuente devengada:/);
    expect(aviso).toHaveTextContent("fecha de timbrado en México, o de emisión si no hay timbrado válido");
    expect(aviso).toHaveTextContent("NC aplicadas por fecha de emisión");
    expect(aviso).toHaveTextContent("facturas de proveedor (CxP) por fecha de emisión y sus NC por fecha del documento");
    expect(aviso).toHaveTextContent("Montos en MXN sin IVA");
    expect(screen.getByText("Sin movimientos devengados en Octubre 2026")).toBeVisible();
    expect(screen.queryByText(/Sin embarques con ETA/)).not.toBeInTheDocument();
  });

  it("conserva ETA y ventas facturadas netas de NC para la fuente operativa", () => {
    controlador("embarques");
    render(pagina);
    expect(screen.getByText(subtituloOperativo)).toBeVisible();
    expect(screen.queryByText(subtituloDevengado)).not.toBeInTheDocument();
    expect(screen.getByText(/Fuente operativa:/)).toHaveTextContent("ventas facturadas netas de NC aplicadas contra conceptos de costo, por ETA del embarque");
    expect(screen.getByText("Sin embarques con ETA en Octubre 2026")).toBeVisible();
    expect(screen.queryByText(/Sin movimientos devengados/)).not.toBeInTheDocument();
  });

  it("actualiza el subtítulo al alternar y volver a la fuente original", () => {
    const c = controlador("facturas");
    const vista = render(pagina);
    fireEvent.click(screen.getByRole("radio", { name: "Fuente operativa (por ETA de embarque)" }));
    expect(c.setFuente).toHaveBeenCalledWith("embarques");
    const operativo = controlador("embarques");
    vista.rerender(<MemoryRouter><ProfitEstadoResultados /></MemoryRouter>);
    expect(screen.getByText(subtituloOperativo)).toBeVisible();
    expect(screen.queryByText(subtituloDevengado)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("radio", { name: "Fuente devengada (facturas emitidas y CxP)" }));
    expect(operativo.setFuente).toHaveBeenCalledWith("facturas");
    controlador("facturas");
    vista.rerender(<MemoryRouter><ProfitEstadoResultados /></MemoryRouter>);
    expect(screen.getByText(subtituloDevengado)).toBeVisible();
    expect(screen.queryByText(subtituloOperativo)).not.toBeInTheDocument();
  });
});
