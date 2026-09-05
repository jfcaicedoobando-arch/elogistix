/**
 * Auditoría CRM — Resumen ejecutivo: EmbudoCard y ForecastMesCard distinguen
 * error (ErrorStateInline + Reintentar) de respuesta exitosa vacía.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const vm = {
  isLoading: false, isError: false, refetch: vi.fn(),
  cotsSinResp: [], cotsError: false, cotsRefetch: vi.fn(),
  nba: [], nbaLoading: false, nbaError: false, nbaRefetch: vi.fn(),
  actividadesHoy: [], cerrandoSemana: [], leadsSinContactar: [],
  kpis: {
    leads: 0, oportunidadesAbiertas: 0, actividadesPendientes: 0,
    pipelinePonderado: 0, pipelinePonderadoPorMoneda: [],
  },
};
const reportes = vi.fn();
const forecast = vi.fn();

vi.mock("@/features/crm/hooks", () => ({
  useCrmInicioVM: () => vm,
  useReportesCRM: (...a: unknown[]) => reportes(...a),
  useForecast: (...a: unknown[]) => forecast(...a),
}));
vi.mock("@/hooks/shared", () => ({ useDocumentTitle: () => {} }));
vi.mock("@/features/crm/components/LeaderboardVendedores", () => ({ default: () => <div /> }));
vi.mock("@/features/crm/components/CrmForecastMesKpis", () => ({ CrmForecastMesKpis: () => <div /> }));

import CrmDashboard from "../CrmDashboard";

const embudoVacio = { embudo: [], motivosPerdida: [], porFuente: [] };
const forecastVacio = { porMes: [], porEtapa: [], monedas: [] };

beforeEach(() => {
  vi.clearAllMocks();
  reportes.mockReturnValue({ data: embudoVacio, isLoading: false, isError: false, refetch: vi.fn() });
  forecast.mockReturnValue({ data: forecastVacio, isLoading: false, isError: false, refetch: vi.fn() });
});

describe("CrmDashboard — embudo y forecast: error vs vacío", () => {
  it("fallo del embudo muestra reintento y NO 'Sin oportunidades aún'", () => {
    const refetch = vi.fn();
    reportes.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    render(<CrmDashboard />);
    expect(screen.getByText(/No se pudo cargar el embudo/i)).toBeInTheDocument();
    expect(screen.queryByText(/Sin oportunidades aún/i)).toBeNull();
    fireEvent.click(screen.getAllByRole("button", { name: /reintentar/i })[0]);
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("fallo del forecast muestra reintento y NO 'Sin datos para los próximos meses'", () => {
    forecast.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch: vi.fn() });
    render(<CrmDashboard />);
    expect(screen.getByText(/No se pudo cargar el forecast/i)).toBeInTheDocument();
    expect(screen.queryByText(/Sin datos para los próximos meses/i)).toBeNull();
    expect(screen.getByRole("button", { name: /reintentar/i })).toBeInTheDocument();
  });

  it("éxito con listas vacías sí muestra los empty-states", () => {
    render(<CrmDashboard />);
    expect(screen.getByText(/Sin oportunidades aún/i)).toBeInTheDocument();
    expect(screen.getByText(/Sin datos para los próximos meses/i)).toBeInTheDocument();
    expect(screen.queryByText(/No se pudo cargar/i)).toBeNull();
  });
});
