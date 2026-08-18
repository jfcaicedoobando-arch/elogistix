import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Ship } from "lucide-react";
import { EmptyStateInline } from "../EmptyStateInline";

describe("EmptyStateInline", () => {
  it("muestra mensaje y hint", () => {
    render(<EmptyStateInline icon={Ship} message="No hay embarques." hint="Crea el primero." />);
    expect(screen.getByText("No hay embarques.")).toBeInTheDocument();
    expect(screen.getByText("Crea el primero.")).toBeInTheDocument();
  });

  it("renderiza CTA con handler", () => {
    const onClick = vi.fn();
    render(<EmptyStateInline message="Sin cuentas." action={{ label: "Crear cuenta", onClick }} />);
    fireEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renderiza CTA como enlace interno cuando recibe `to`", () => {
    render(
      <MemoryRouter>
        <EmptyStateInline message="Sin navieras." action={{ label: "Catálogo", to: "/catalogos" }} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Catálogo" })).toHaveAttribute("href", "/catalogos");
  });

  it("density=compact reduce el padding", () => {
    const { container } = render(<EmptyStateInline message="Sin datos." density="compact" />);
    expect(container.firstElementChild?.className).toContain("py-3");
  });

  it("loading muestra spinner en vez de icono", () => {
    const { container } = render(<EmptyStateInline loading message="Cargando..." icon={Ship} />);
    expect(container.querySelector(".animate-spin")).not.toBeNull();
  });
});
