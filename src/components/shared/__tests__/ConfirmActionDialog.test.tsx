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
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it("muestra estado pending", () => {
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
  });
});
