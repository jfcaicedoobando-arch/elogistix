/**
 * Pulido visual CRM: LeadLineageCard debe formatear la fecha estimada de cierre
 * con el formateador canónico, nunca mostrar ISO crudo, y conservar "—" para
 * valores nulos.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const leadLineage = vi.fn();

vi.mock("@/features/crm/hooks", () => ({
  useLeadLineage: (leadId: string) => leadLineage(leadId),
}));

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
  Link: ({ children }: { children: React.ReactNode }) => <a href="#">{children}</a>,
}));

vi.mock("@/components/shared/dataTable/DrilldownRow", () => ({
  DrilldownRow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { LeadLineageCard } from "@/features/crm/components/LineageCard";

beforeEach(() => {
  leadLineage.mockReset();
});

describe("LeadLineageCard — formato de fechas", () => {
  it("no renderiza la fecha ISO cruda y muestra formato dd/MM/yyyy", () => {
    leadLineage.mockReturnValue({
      data: [
        {
          id: "op-1",
          nombre: "Oportunidad uno",
          monto_estimado: 150000,
          moneda: "MXN",
          probabilidad: 60,
          fecha_estimada_cierre: "2026-12-25",
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<LeadLineageCard leadId="l-1" />);

    expect(screen.getByText(/25\/12\/2026/)).toBeInTheDocument();
    expect(screen.queryByText(/2026-12-25/)).toBeNull();
  });

  it("muestra '—' cuando la fecha estimada es nula", () => {
    leadLineage.mockReturnValue({
      data: [
        {
          id: "op-2",
          nombre: "Oportunidad dos",
          monto_estimado: 0,
          moneda: "MXN",
          probabilidad: 0,
          fecha_estimada_cierre: null,
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<LeadLineageCard leadId="l-1" />);

    expect(screen.getByText(/cierre —/)).toBeInTheDocument();
    expect(screen.queryByText(/\d{4}-\d{2}-\d{2}/)).toBeNull();
  });
});
