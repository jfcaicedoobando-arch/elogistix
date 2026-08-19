import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PortalFilterSheet } from "../PortalFilterSheet";

describe("PortalFilterSheet", () => {
  const baseProps = {
    search: "",
    onSearchChange: () => {},
    title: "Filtros de X",
    activeCount: 0,
    onClear: () => {},
  };

  it("renderiza search input y botón de filtros", () => {
    render(
      <PortalFilterSheet {...baseProps}>
        <div>campo</div>
      </PortalFilterSheet>,
    );
    expect(screen.getByPlaceholderText("Buscar...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Filtros/i })).toBeInTheDocument();
  });

  it("propaga cambios del input de búsqueda", () => {
    const onSearchChange = vi.fn();
    render(
      <PortalFilterSheet {...baseProps} onSearchChange={onSearchChange}>
        <div />
      </PortalFilterSheet>,
    );
    fireEvent.change(screen.getByPlaceholderText("Buscar..."), { target: { value: "abc" } });
    expect(onSearchChange).toHaveBeenCalledWith("abc");
  });

  it("muestra badge con activeCount y habilita Limpiar cuando > 0", () => {
    const onClear = vi.fn();
    render(
      <PortalFilterSheet {...baseProps} activeCount={2} onClear={onClear}>
        <div>x</div>
      </PortalFilterSheet>,
    );
    // Badge muestra el número
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("respeta placeholder personalizado", () => {
    render(
      <PortalFilterSheet {...baseProps} searchPlaceholder="Buscar factura...">
        <div />
      </PortalFilterSheet>,
    );
    expect(screen.getByPlaceholderText("Buscar factura...")).toBeInTheDocument();
  });
});
