import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { GarantiasKpiCards } from "@/features/embarques/components/garantias/GarantiasKpiCards";

describe("<GarantiasKpiCards />", () => {
  it("renderiza los 4 KPIs con labels canónicos", () => {
    render(
      <GarantiasKpiCards
        totalDeposito={10000}
        totalPendiente={2500}
        count={7}
        diasPromRecuperacion={14}
      />,
    );
    expect(screen.getByText("Depósito total")).toBeInTheDocument();
    expect(screen.getByText("Por recuperar")).toBeInTheDocument();
    expect(screen.getByText("Contenedores")).toBeInTheDocument();
    expect(screen.getByText("Días prom. recuperación")).toBeInTheDocument();
    expect(screen.getByText("7")).toBeInTheDocument();
    expect(screen.getByText("14 d")).toBeInTheDocument();
  });

  it("muestra '—' cuando diasPromRecuperacion es null", () => {
    render(
      <GarantiasKpiCards
        totalDeposito={0}
        totalPendiente={0}
        count={0}
        diasPromRecuperacion={null}
      />,
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("aplica variantes info/warning/success del KpiCard canónico", () => {
    const { container } = render(
      <GarantiasKpiCards
        totalDeposito={1}
        totalPendiente={1}
        count={1}
        diasPromRecuperacion={1}
      />,
    );
    expect(container.querySelector(".border-info\\/30")).not.toBeNull();
    expect(container.querySelector(".border-warning\\/30")).not.toBeNull();
    expect(container.querySelector(".border-success\\/30")).not.toBeNull();
  });
});
