/**
 * v13.823.228: el flujo canónico es Lead → Prospecto → Oportunidad, así que la
 * tarjeta "Oportunidades generadas" no debe aparecer vacía en un lead.
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

describe("LeadLineageCard — sin oportunidades", () => {
  it("no renderiza la tarjeta cuando el lead no tiene oportunidades", () => {
    leadLineage.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<LeadLineageCard leadId="l1" />);
    expect(screen.queryByText("Oportunidades generadas")).toBeNull();
  });

  it("renderiza la tarjeta cuando existe histórico", () => {
    leadLineage.mockReturnValue({
      data: [
        {
          id: "op-1",
          nombre: "Oportunidad histórica",
          monto_estimado: 1000,
          moneda: "MXN",
          probabilidad: 50,
          fecha_estimada_cierre: "2026-12-25",
        },
      ],
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    render(<LeadLineageCard leadId="l1" />);
    expect(screen.getByText("Oportunidades generadas")).toBeInTheDocument();
    expect(screen.getByText("Oportunidad histórica")).toBeInTheDocument();
  });
});
