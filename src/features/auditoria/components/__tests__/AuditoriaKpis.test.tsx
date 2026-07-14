import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { AuditoriaKpis } from "@/features/auditoria/components/AuditoriaKpis";

describe("<AuditoriaKpis />", () => {
  it("renderiza los 3 KPIs con sus valores y sublabels", () => {
    render(<AuditoriaKpis critico={5} alto={12} medio={3} />);
    expect(screen.getByText("Críticos")).toBeInTheDocument();
    expect(screen.getByText("Altos")).toBeInTheDocument();
    expect(screen.getByText("Medios")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText(/Requieren atención/i)).toBeInTheDocument();
  });

  it("aplica variantes semánticas destructive/warning/info del KpiCard canónico", () => {
    const { container } = render(<AuditoriaKpis critico={1} alto={1} medio={1} />);
    expect(container.querySelector(".border-destructive\\/30")).not.toBeNull();
    expect(container.querySelector(".border-warning\\/30")).not.toBeNull();
    expect(container.querySelector(".border-info\\/30")).not.toBeNull();
  });

  it("formatea números grandes con separador de miles", () => {
    render(<AuditoriaKpis critico={1234} alto={0} medio={0} />);
    expect(screen.getByText("1,234")).toBeInTheDocument();
  });
});
