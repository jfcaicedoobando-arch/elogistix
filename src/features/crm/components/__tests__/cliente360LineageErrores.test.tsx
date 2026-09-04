/**
 * Tercera tanda YAGNI · hallazgo 1 — Cliente 360 y trazabilidad distinguen
 * "sin datos" de "no se pudieron cargar los datos": ante error muestran el
 * bloque de error con botón Reintentar, no listas/KPIs vacíos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

const cliente360 = vi.fn();
const leadLineage = vi.fn();
const opLineage = vi.fn();

vi.mock("@/features/crm/hooks", () => ({
  useCliente360: () => cliente360(),
  useLeadLineage: () => leadLineage(),
  useOportunidadLineage: () => opLineage(),
}));
vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}));
vi.mock("@/features/crm/components/ActividadTimeline", () => ({
  default: () => <div data-testid="timeline" />,
}));
vi.mock("@/components/shared/dataTable/DrilldownRow", () => ({
  DrilldownRow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import Cliente360Panel from "@/features/crm/components/Cliente360Panel";
import { LeadLineageCard, OportunidadLineageCard } from "@/features/crm/components/LineageCard";

beforeEach(() => {
  cliente360.mockReset();
  leadLineage.mockReset();
  opLineage.mockReset();
});

describe("Cliente360Panel — error visible", () => {
  it("muestra error y reintento en vez de KPIs en cero", () => {
    const refetch = vi.fn();
    cliente360.mockReturnValue({
      data: undefined, isLoading: false, isError: true,
      error: new Error("falló la red"), refetch,
    });
    render(<Cliente360Panel clienteId="cli-1" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/Sin oportunidades registradas/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("caso exitoso vacío sigue mostrando el empty-state", () => {
    cliente360.mockReturnValue({
      data: { oportunidades: [], totales: [], ultimaCotizacion: null, ultimoEmbarque: null },
      isLoading: false, isError: false, error: null, refetch: vi.fn(),
    });
    render(<Cliente360Panel clienteId="cli-1" />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/Sin oportunidades registradas/i)).toBeInTheDocument();
  });
});

describe("LineageCard — error visible", () => {
  it("LeadLineageCard muestra error con reintento", () => {
    const refetch = vi.fn();
    leadLineage.mockReturnValue({
      data: undefined, isLoading: false, isError: true, error: new Error("boom"), refetch,
    });
    render(<LeadLineageCard leadId="l-1" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/aún no tiene oportunidades/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }));
    expect(refetch).toHaveBeenCalledTimes(1);
  });

  it("OportunidadLineageCard muestra error y oculta los vacíos", () => {
    opLineage.mockReturnValue({
      cots: [], embs: [], lead: null, isLoadingCots: false, isError: true, refetch: vi.fn(),
    });
    render(<OportunidadLineageCard oportunidadId="op-1" leadId="l-1" />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.queryByText(/Sin embarques generados todavía/i)).toBeNull();
  });

  it("sin error, la lista vacía sigue diciendo que no hay cotizaciones", () => {
    opLineage.mockReturnValue({
      cots: [], embs: [], lead: null, isLoadingCots: false, isError: false, refetch: vi.fn(),
    });
    render(<OportunidadLineageCard oportunidadId="op-1" leadId={null} />);
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByText(/Aún no hay cotizaciones vinculadas/i)).toBeInTheDocument();
  });
});
