import { EstadoResultadosTable } from "../../components/EstadoResultadosTable";
import { formatCurrency } from "@/lib/formatters";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import ProfitEstadoResultados from "../ProfitEstadoResultados";
import { useEstadoResultados } from "@/features/profit/hooks/useEstadoResultados";
import { exportToCsv } from "@/generators/exportCsv";
import { usePdfExport } from "@/hooks/shared";
import { buildEstadoResultados } from "@/features/profit/domain/estadoResultados";

vi.mock("@/features/profit/hooks/useEstadoResultados", () => ({ useEstadoResultados: vi.fn() }));
vi.mock("@/features/profit/hooks/useFuenteEerr", () => ({ useFuenteEerr: () => ({ fuente: "facturas", setFuente: vi.fn() }) }));
vi.mock("@/features/catalogos/hooks", () => ({ useExchangeRates: () => ({ data: { esFallback: false } }) }));
vi.mock("@/features/catalogos/services", () => ({ fetchExchangeRates: vi.fn(), EXCHANGE_RATES_FALLBACK: { usdMxn: 20, eurMxn: 22 } }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {} }));
vi.mock("@/hooks/shared", () => ({ usePdfExport: vi.fn() }));
vi.mock("@/generators/exportCsv", () => ({ exportToCsv: vi.fn() }));
vi.mock("@/pdf/render/descargarPdf", () => ({ descargarPdf: vi.fn() }));

const mes = { key: "2026-10", label: "Octubre 2026", year: 2026, month: 10 };
const runPdfExport = vi.fn();

describe("EX01: missing exchange rates on the real EERR screen", () => {
  it("shows the excluded nominal and blocks CSV/PDF even when all rows were excluded", () => {
    vi.clearAllMocks();
    vi.mocked(usePdfExport).mockReturnValue({ isExporting: false, run: runPdfExport });
    const data = buildEstadoResultados([{ id: 'ex01', modo: 'Marítimo', tipo_cambio_usd: null, tipo_cambio_eur: null }], [],
      [{ embarque_id: 'ex01', concepto: 'Flete USD', monto: 100, moneda: 'USD' }]);
    vi.mocked(useEstadoResultados).mockReturnValue({
      organizationId: "org-test", mesActual: mes, mesesDisponibles: [mes], setMesKey: vi.fn(), irMesAnterior: vi.fn(), irMesSiguiente: vi.fn(),
      puedeIrAtras: false, puedeIrAdelante: false, data, isLoading: false, isError: false, error: null,
      refetch: vi.fn(), fuente: "embarques", setFuente: vi.fn(),
    });
    render(<MemoryRouter><ProfitEstadoResultados /></MemoryRouter>);
    expect(screen.getByText(/Valuación incompleta:/)).toBeInTheDocument();
    expect(screen.getByText(/100 USD/)).toBeInTheDocument();
    expect(screen.getAllByText('No disponible').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Sin embarques con ETA en/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Exportar CSV'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'PDF'})).toBeDisabled();
    fireEvent.click(screen.getByRole('button', {name: 'Exportar CSV'}));
    fireEvent.click(screen.getByRole('button', {name: 'PDF'}));
    expect(exportToCsv).not.toHaveBeenCalled();
    expect(runPdfExport).not.toHaveBeenCalled();
  });
});


it("shows the loss while keeping margin neutral when income is zero", () => {
  const data = buildEstadoResultados([{ id: 'zero', modo: 'Marítimo', tipo_cambio_usd: null, tipo_cambio_eur: null }], [],
    [{ embarque_id: 'zero', concepto: 'Costo MXN', monto: 100, moneda: 'MXN' }]);
  const {container} = render(<EstadoResultadosTable data={data} />);
  expect(screen.getAllByText('No calculable').length).toBeGreaterThan(0);
  expect(screen.getAllByText(formatCurrency(-100, 'MXN')).length).toBeGreaterThan(0);
  expect(container.querySelector('.text-success')).toBeNull();
});
