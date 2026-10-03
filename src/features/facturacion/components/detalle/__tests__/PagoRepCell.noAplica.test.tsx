import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
vi.mock("@/features/facturacion/hooks", () => ({ useTimbrarRep: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock("@/features/facturacion/hooks/useConsultarRep", () => ({ useConsultarRep: () => ({ mutate: vi.fn(), isPending: false }) }));
vi.mock("@/features/facturacion/components/FacturaDownloadButton", () => ({ FacturaDownloadButton: () => null }));
import { PagoRepCell } from "../PagoRepCell";

describe("estado REP persistido", () => {
  it("NoAplica informa que no requiere REP y no ofrece acciones fiscales", () => {
    render(<PagoRepCell pagoId="p1" estadoRep="NoAplica" serieRep={null} folioRep={null} onPreview={vi.fn()} />);
    expect(screen.getByText("REP no aplica")).toBeInTheDocument();
    expect(screen.queryByText("REP pendiente")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
  it("Pendiente conserva su indicador", () => {
    render(<PagoRepCell pagoId="p2" estadoRep="Pendiente" serieRep={null} folioRep={null} onPreview={vi.fn()} />);
    expect(screen.getByText("REP pendiente")).toBeInTheDocument();
  });
});
