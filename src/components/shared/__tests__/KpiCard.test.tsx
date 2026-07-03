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
});
