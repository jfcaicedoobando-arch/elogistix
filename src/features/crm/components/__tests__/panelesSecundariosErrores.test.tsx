/**
 * Auditoría CRM — paneles secundarios: error ≠ vacío.
 * CrmForecastMesKpis / LeaderboardVendedores / Cliente360Panel deben mostrar
 * ErrorStateInline con Reintentar ante fallo y reservar ceros/empty para
 * respuestas exitosas sin filas.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const forecast = vi.fn();
const leaderboard = vi.fn();
const cliente360 = vi.fn();

vi.mock("@/features/crm/hooks", () => ({
  useForecast: (...a: unknown[]) => forecast(...a),
  useLeaderboardVendedores: (...a: unknown[]) => leaderboard(...a),
  useCliente360: (...a: unknown[]) => cliente360(...a),
}));
vi.mock("@/lib/contexts/AuthContext", () => ({
  useAuth: () => ({ user: { id: "u-1", email: "v@x.com" } }),
}));
vi.mock("@/features/crm/components/ActividadTimeline", () => ({ default: () => <div /> }));

import { CrmForecastMesKpis } from "../CrmForecastMesKpis";
import LeaderboardVendedores from "../LeaderboardVendedores";
import Cliente360Panel from "../Cliente360Panel";

const c360Vacio = { oportunidades: [], totales: [], ultimaCotizacion: null, ultimoEmbarque: null };

beforeEach(() => {
  vi.clearAllMocks();
  forecast.mockReturnValue({ data: { totalesPorMoneda: [] }, isLoading: false, isError: false, refetch: vi.fn() });
  leaderboard.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
  cliente360.mockReturnValue({ data: c360Vacio, isLoading: false, isError: false, error: null, refetch: vi.fn() });
});

describe("CrmForecastMesKpis — error vs ceros", () => {
  it("error muestra reintento y NO KPIs en cero", () => {
    const refetch = vi.fn();
    forecast.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    render(<CrmForecastMesKpis />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/No se pudo cargar el forecast del mes/i)).toBeInTheDocument();
    expect(screen.queryByText("Pipeline")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("éxito sin movimientos sí muestra la tira en ceros", () => {
    render(<CrmForecastMesKpis />);
    expect(screen.getByText("Pipeline")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("LeaderboardVendedores — error vs vacío", () => {
  it("error muestra reintento y NO 'Sin actividad de cierre'", () => {
    const refetch = vi.fn();
    leaderboard.mockReturnValue({ data: undefined, isLoading: false, isError: true, refetch });
    render(<LeaderboardVendedores />);
    expect(screen.getByText(/No se pudo cargar el leaderboard/i)).toBeInTheDocument();
    expect(screen.queryByText(/Sin actividad de cierre/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("éxito sin cierres sí muestra 'Sin actividad de cierre este mes.'", () => {
    render(<LeaderboardVendedores />);
    expect(screen.getByText(/Sin actividad de cierre este mes/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});

describe("Cliente360Panel — error vs vacío", () => {
  it("error muestra reintento y NO KPIs en cero ni 'Sin oportunidades'", () => {
    const refetch = vi.fn();
    cliente360.mockReturnValue({
      data: undefined, isLoading: false, isError: true,
      error: new Error("RLS denegado"), refetch,
    });
    render(<MemoryRouter><Cliente360Panel clienteId="c-1" /></MemoryRouter>);
    expect(screen.getByText(/No se pudieron cargar los datos CRM del cliente/i)).toBeInTheDocument();
    expect(screen.queryByText(/Sin oportunidades registradas/i)).toBeNull();
    expect(screen.queryByText("Pipeline abierto")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("éxito sin datos sí muestra KPIs en cero y empty de oportunidades", () => {
    render(<MemoryRouter><Cliente360Panel clienteId="c-1" /></MemoryRouter>);
    expect(screen.getByText("Pipeline abierto")).toBeInTheDocument();
    expect(screen.getByText(/Sin oportunidades registradas/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
