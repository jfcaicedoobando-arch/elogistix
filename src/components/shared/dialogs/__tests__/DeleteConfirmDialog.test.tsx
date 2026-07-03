import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { DeleteConfirmDialog } from "@/components/shared/dialogs/DeleteConfirmDialog";

describe("<DeleteConfirmDialog />", () => {
  it("paso 1: muestra pregunta y avanza a paso 2 con Continuar", () => {
    render(
      <DeleteConfirmDialog
        open
        onOpenChange={() => {}}
        entityName="cotización FS-001"
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText(/¿Eliminar cotización FS-001\?/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    // Paso 2 aparece
    expect(screen.getByText(/confirmar eliminación/i)).toBeInTheDocument();
  });

  it("paso 2: sólo confirma cuando se escribe ELIMINAR", () => {
    const onConfirm = vi.fn();
    render(
      <DeleteConfirmDialog
        open
        onOpenChange={() => {}}
        entityName="X"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "eliminar" } });
    // Case-insensitive: "eliminar" también permite confirmar.
    const delBtn = screen.getByRole("button", { name: /eliminar/i });
    expect(delBtn).not.toBeDisabled();
    fireEvent.click(delBtn);
    expect(onConfirm).toHaveBeenCalled();
  });
});
