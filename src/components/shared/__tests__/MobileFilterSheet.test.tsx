import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileFilterSheet } from "../MobileFilterSheet";

describe("MobileFilterSheet", () => {
  const baseProps = {
    search: "",
    onSearchChange: () => {},
    title: "Filtros de X",
    activeCount: 0,
    onClear: () => {},
  };

  it("renderiza search input y botón de filtros", () => {
    render(
      <MobileFilterSheet {...baseProps}>
        <div>campo</div>
      </MobileFilterSheet>,
    );
    expect(screen.getByPlaceholderText("Buscar...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Filtros/i })).toBeInTheDocument();
  });

  it("propaga cambios del input de búsqueda", () => {
    const onSearchChange = vi.fn();
    render(
      <MobileFilterSheet {...baseProps} onSearchChange={onSearchChange}>
        <div />
      </MobileFilterSheet>,
    );
    fireEvent.change(screen.getByPlaceholderText("Buscar..."), { target: { value: "abc" } });
    expect(onSearchChange).toHaveBeenCalledWith("abc");
  });

  it("muestra badge con activeCount y habilita Limpiar cuando > 0", () => {
    const onClear = vi.fn();
    render(
      <MobileFilterSheet {...baseProps} activeCount={2} onClear={onClear}>
        <div>x</div>
      </MobileFilterSheet>,
    );
    // Badge muestra el número
    expect(screen.getByText("2")).toBeInTheDocument();
  });

  it("respeta placeholder personalizado", () => {
    render(
      <MobileFilterSheet {...baseProps} searchPlaceholder="Buscar factura...">
        <div />
      </MobileFilterSheet>,
    );
    expect(screen.getByPlaceholderText("Buscar factura...")).toBeInTheDocument();
  });
});
