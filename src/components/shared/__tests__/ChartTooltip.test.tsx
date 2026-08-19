import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChartTooltip } from "@/components/shared/ChartTooltip";

describe("ChartTooltip (Ola D · #18)", () => {
  it("no renderiza nada cuando está inactivo o sin datos", () => {
    const { container, rerender } = render(<ChartTooltip active={false} payload={[{ name: "a", value: 1 }]} />);
    expect(container.firstChild).toBeNull();
    rerender(<ChartTooltip active payload={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it("muestra el label y una fila por serie con formato es-MX", () => {
    render(
      <ChartTooltip
        active
        label="ago"
        payload={[
          { name: "Entradas", value: 1234.5, color: "#000" },
          { name: "Salidas", value: -900 },
        ]}
      />,
    );
    expect(screen.getByText("ago")).toBeInTheDocument();
    expect(screen.getByText("1,234.50")).toBeInTheDocument();
    expect(screen.getByText("-900")).toBeInTheDocument();
  });

  it("usa `formatValue` cuando se provee y omite series sin valor numérico", () => {
    render(
      <ChartTooltip
        active
        label="sem 32"
        formatValue={(v, serie) => `${serie}:${v.toFixed(2)}`}
        payload={[
          { name: "Saldo", value: 10 },
          { name: "Vacía", value: null },
        ]}
      />,
    );
    expect(screen.getByText("Saldo:10.00")).toBeInTheDocument();
    expect(screen.queryByText("Vacía")).not.toBeInTheDocument();
  });
});
