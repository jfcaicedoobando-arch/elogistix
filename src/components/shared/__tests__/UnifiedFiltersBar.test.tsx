import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { UnifiedFiltersBar } from "@/components/shared/filters/UnifiedFiltersBar";

describe("<UnifiedFiltersBar />", () => {
  const baseProps = {
    search: "",
    onSearchChange: () => {},
    chips: [],
    activeCount: 0,
    onClearAll: () => {},
  };

  it("renderiza el input de búsqueda con placeholder por defecto", () => {
    render(<UnifiedFiltersBar {...baseProps} />);
    expect(screen.getByPlaceholderText("Buscar…")).toBeInTheDocument();
  });

  it("muestra chip de búsqueda y llama onSearchChange('') al quitarlo", () => {
    const onSearchChange = vi.fn();
    render(
      <UnifiedFiltersBar
        {...baseProps}
        search="acme"
        onSearchChange={onSearchChange}
      />,
    );
    expect(screen.getByText(/Búsqueda: acme/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /quitar búsqueda/i }));
    expect(onSearchChange).toHaveBeenCalledWith("");
  });

  it("renderiza chips y llama onRemove del chip clickeado", () => {
    const remove = vi.fn();
    render(
      <UnifiedFiltersBar
        {...baseProps}
        chips={[{ key: "estado", label: "Estado: Emitida", onRemove: remove }]}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /quitar estado/i }));
    expect(remove).toHaveBeenCalled();
  });

  it("muestra 'Limpiar todo' sólo con >1 chip/búsqueda", () => {
    const onClearAll = vi.fn();
    const { rerender } = render(
      <UnifiedFiltersBar
        {...baseProps}
        chips={[{ key: "a", label: "A: 1", onRemove: () => {} }]}
      />,
    );
    expect(screen.queryByRole("button", { name: /limpiar todo/i })).toBeNull();
    rerender(
      <UnifiedFiltersBar
        {...baseProps}
        search="x"
        chips={[{ key: "a", label: "A: 1", onRemove: () => {} }]}
        onClearAll={onClearAll}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /limpiar todo/i }));
    expect(onClearAll).toHaveBeenCalled();
  });

  it("renderiza slot primary y secondary", () => {
    render(
      <UnifiedFiltersBar
        {...baseProps}
        primary={<span>primary-slot</span>}
        secondary={<span>secondary-slot</span>}
      />,
    );
    expect(screen.getByText("primary-slot")).toBeInTheDocument();
    // secondary vive dentro del Sheet; el trigger aparece siempre.
    expect(
      screen.getByRole("button", { name: /filtros|filtrar/i }),
    ).toBeInTheDocument();
  });
});
