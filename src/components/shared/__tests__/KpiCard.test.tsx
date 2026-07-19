import { fireEvent, render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { TrendingUp } from "lucide-react";
import { KpiCard } from "@/components/shared/KpiCard";

describe("<KpiCard />", () => {
  it("renderiza label y value", () => {
    render(<KpiCard label="Ventas" value="$1,234.00" />);
    expect(screen.getByText("Ventas")).toBeInTheDocument();
    expect(screen.getByText("$1,234.00")).toBeInTheDocument();
  });

  it("muestra delta con la clase semántica correcta", () => {
    render(<KpiCard label="X" value="10" delta="+5%" deltaVariant="positive" />);
    const delta = screen.getByText("+5%");
    expect(delta.className).toContain("text-success");
  });

  it("es clickeable cuando se pasa onClick", async () => {
    const onClick = vi.fn();
    render(<KpiCard label="X" value="1" onClick={onClick} icon={TrendingUp} />);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("aplica estilos por variant", () => {
    const { container } = render(
      <KpiCard label="X" value="1" variant="success" />,
    );
    expect(container.querySelector(".border-success\\/30")).not.toBeNull();
  });

  it("muestra sublabel cuando no hay delta", () => {
    render(<KpiCard label="X" value="1" sublabel="Últimos 7 días" />);
    expect(screen.getByText("Últimos 7 días")).toBeInTheDocument();
  });

  it("variant default no aplica bordes de color semántico", () => {
    const { container } = render(<KpiCard label="X" value="1" />);
    expect(container.querySelector(".border-destructive\\/30")).toBeNull();
    expect(container.querySelector(".border-warning\\/30")).toBeNull();
    expect(container.querySelector(".border-info\\/30")).toBeNull();
    expect(container.querySelector(".border-success\\/30")).toBeNull();
  });

  it("valueTooltip se expone en el atributo title del valor", () => {
    render(
      <KpiCard label="Profit" value="USD 1.2M" valueTooltip="USD 1,234,567.89" />,
    );
    expect(screen.getByText("USD 1.2M").getAttribute("title")).toBe("USD 1,234,567.89");
  });

  it("renderiza children debajo del cuerpo", () => {
    render(
      <KpiCard label="TEU" value="20 / 25">
        <div data-testid="kpi-child">progress</div>
      </KpiCard>,
    );
    expect(screen.getByTestId("kpi-child")).toBeInTheDocument();
  });

  it("iconVariant='chip' pinta el icono en un chip tintado", () => {
    const { container } = render(
      <KpiCard label="X" value="1" icon={TrendingUp} variant="accent" iconVariant="chip" />,
    );
    // El chip usa las clases utilitarias `bg-kpi-accent-soft text-kpi-accent`.
    expect(container.querySelector(".bg-kpi-accent-soft")).not.toBeNull();
  });
});
