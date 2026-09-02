import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DoubleConfirmDeleteDialog from "@/components/shared/DoubleConfirmDeleteDialog";

describe("<DoubleConfirmDeleteDialog />", () => {
  it("muestra paso 1 con descripción por defecto y botón Continuar", () => {
    render(
      <DoubleConfirmDeleteDialog
        open
        onOpenChange={() => {}}
        entityName="el embarque LC-001"
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText(/¿Eliminar el embarque LC-001\?/i)).toBeInTheDocument();
    expect(screen.getByText(/Se eliminará el embarque LC-001/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /continuar/i })).toBeInTheDocument();
  });

  it("cancelar en paso 1 cierra sin llamar onConfirm", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <DoubleConfirmDeleteDialog
        open
        onOpenChange={onOpenChange}
        entityName="factura F-1"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("Continuar avanza a paso 2 con input de confirmación deshabilitando eliminar", () => {
    render(
      <DoubleConfirmDeleteDialog
        open
        onOpenChange={() => {}}
        entityName="cliente ACME"
        finalDescription="Acción irreversible."
        onConfirm={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    expect(screen.getByText(/confirmar eliminación/i)).toBeInTheDocument();
    expect(screen.getByText("Acción irreversible.")).toBeInTheDocument();
    const eliminar = screen.getByRole("button", { name: /eliminar definitivamente/i });
    expect(eliminar).toBeDisabled();
  });

  it("habilita eliminar sólo al tipear ELIMINAR (case-insensitive) y ejecuta onConfirm", async () => {
    const onConfirm = vi.fn();
    render(
      <DoubleConfirmDeleteDialog
        open
        onOpenChange={() => {}}
        entityName="proveedor X"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

    const input = screen.getByPlaceholderText("ELIMINAR");
    const btn = screen.getByRole("button", { name: /eliminar definitivamente/i });

    fireEvent.change(input, { target: { value: "eliminar mal" } });
    expect(btn).toBeDisabled();

    fireEvent.change(input, { target: { value: "eliminar" } });
    expect(btn).not.toBeDisabled();

    fireEvent.click(btn);
    // esperar microtask del await onConfirm
    await Promise.resolve();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("cancelar en paso 2 no dispara onConfirm", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <DoubleConfirmDeleteDialog
        open
        onOpenChange={onOpenChange}
        entityName="registro"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("estado pending muestra 'Eliminando...' y deshabilita el botón", () => {
    render(
      <DoubleConfirmDeleteDialog
        open
        onOpenChange={() => {}}
        entityName="registro"
        isPending
        onConfirm={() => {}}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    fireEvent.change(screen.getByPlaceholderText("ELIMINAR"), {
      target: { value: "ELIMINAR" },
    });
    // Defecto 1: además del botón, se muestra el aviso "Eliminando… no cierres".
    expect(screen.getAllByText(/eliminando/i).length).toBeGreaterThan(0);
    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /eliminando/i })).toBeDisabled();
  });

  it("presionar Enter en el input ejecuta onConfirm cuando el texto es ELIMINAR", async () => {
    const onConfirm = vi.fn();
    render(
      <DoubleConfirmDeleteDialog
        open
        onOpenChange={() => {}}
        entityName="registro"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));

    const input = screen.getByPlaceholderText("ELIMINAR");
    fireEvent.change(input, { target: { value: "ELIMINAR" } });
    fireEvent.keyDown(input, { key: "Enter", code: "Enter" });

    await Promise.resolve();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("N-EC-02: si onConfirm rechaza NO cierra el diálogo ni deja rejection suelto", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("boom"));
    const onOpenChange = vi.fn();
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <DoubleConfirmDeleteDialog
        open
        onOpenChange={onOpenChange}
        entityName="registro"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /continuar/i }));
    fireEvent.change(screen.getByPlaceholderText("ELIMINAR"), {
      target: { value: "ELIMINAR" },
    });
    fireEvent.click(screen.getByRole("button", { name: /eliminar definitivamente/i }));
    await Promise.resolve();
    await Promise.resolve();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
