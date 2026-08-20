import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MargenBadge, MargenTexto } from "@/components/shared/MargenBadge";

describe("MargenBadge (Ola 5 · 5.6)", () => {
  it("formatea el porcentaje con el formateador canónico", () => {
    render(<MargenBadge pct={12.34} />);
    expect(screen.getByText("12.3 %")).toBeInTheDocument();
  });

  it("muestra guion cuando no hay dato", () => {
    render(<MargenBadge pct={null} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("acepta etiqueta forzada", () => {
    render(<MargenBadge pct={5} label="Margen bajo" />);
    expect(screen.getByText("Margen bajo")).toBeInTheDocument();
  });

  it("MargenTexto colorea según el tono", () => {
    const { container } = render(<MargenTexto pct={-3} />);
    expect(container.firstChild).toHaveClass("text-destructive");
  });
});
