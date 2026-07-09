import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";

describe("<ConfirmActionDialog />", () => {
  it("invoca onConfirm al aceptar", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmActionDialog
        open
        onOpenChange={() => {}}
        title="¿Confirmar?"
        description="Detalle"
        onConfirm={onConfirm}
      />,
    );
    expect(screen.getByText("¿Confirmar?")).toBeInTheDocument();
    expect(screen.getByText("Detalle")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("invoca onOpenChange(false) al cancelar y NO llama onConfirm", () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <ConfirmActionDialog
        open
        onOpenChange={onOpenChange}
        title="¿Confirmar?"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("respeta labels custom (confirmLabel / cancelLabel)", () => {
    render(
      <ConfirmActionDialog
        open
        onOpenChange={() => {}}
        title="X"
        confirmLabel="Sí, aplicar"
        cancelLabel="Volver"
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Sí, aplicar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Volver" })).toBeInTheDocument();
  });

  it("muestra estado pending y deshabilita botones", () => {
    render(
      <ConfirmActionDialog
        open
        onOpenChange={() => {}}
        title="X"
        isPending
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText(/procesando/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /procesando/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /cancelar/i })).toBeDisabled();
  });

  it("aplica variant destructive al botón de confirmación", () => {
    render(
      <ConfirmActionDialog
        open
        onOpenChange={() => {}}
        title="X"
        variant="destructive"
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: /confirmar/i }).className).toMatch(
      /bg-destructive/,
    );
  });

  it("no renderiza contenido cuando open=false", () => {
    render(
      <ConfirmActionDialog
        open={false}
        onOpenChange={() => {}}
        title="Oculto"
        onConfirm={() => {}}
      />,
    );
    expect(screen.queryByText("Oculto")).not.toBeInTheDocument();
  });
});
