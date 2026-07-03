import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PortalFiltersBar } from "@/components/shared/PortalFiltersBar";

describe("<PortalFiltersBar />", () => {
  it("renderiza search y llama onSearchChange", async () => {
    const onSearchChange = vi.fn();
    render(
      <PortalFiltersBar
        search=""
        onSearchChange={onSearchChange}
        searchPlaceholder="Buscar..."
        hideOnMobile={false}
      />,
    );
    const input = screen.getByPlaceholderText("Buscar...");
    await userEvent.type(input, "abc");
    expect(onSearchChange).toHaveBeenCalled();
    expect(onSearchChange).toHaveBeenLastCalledWith("c");
  });

  it("renderiza selects con opciones y 'Todos'", () => {
    render(
      <PortalFiltersBar
        search=""
        onSearchChange={() => {}}
        hideOnMobile={false}
        selects={[
          {
            value: "todos",
            onChange: () => {},
            options: ["Timbrada", "Vencida"],
            placeholder: "Estado",
            allLabel: "Todos los estados",
          },
        ]}
      />,
    );
    expect(screen.getByTitle("Estado")).toBeInTheDocument();
  });

  it("oculta la barra en mobile cuando hideOnMobile=true", () => {
    const { container } = render(
      <PortalFiltersBar
        search=""
        onSearchChange={() => {}}
        hideOnMobile
      />,
    );
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("hidden");
    expect(root.className).toContain("sm:flex");
  });
});
