/**
 * N-EC-02 — `ConfirmActionDialog` no debe dejar promesas rechazadas sueltas
 * cuando el caller propaga el error de su mutación.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConfirmActionDialog } from "@/components/shared/dialogs/ConfirmActionDialog";

describe("<ConfirmActionDialog />", () => {
  it("ejecuta onConfirm al confirmar", async () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmActionDialog
        open
        onOpenChange={() => {}}
        title="¿Confirmar acción?"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    await Promise.resolve();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("captura el rechazo de onConfirm y lo registra en consola", async () => {
    const onConfirm = vi.fn().mockRejectedValue(new Error("boom"));
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <ConfirmActionDialog
        open
        onOpenChange={() => {}}
        title="¿Confirmar acción?"
        onConfirm={onConfirm}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    await Promise.resolve();
    await Promise.resolve();
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(errSpy).toHaveBeenCalled();
    errSpy.mockRestore();
  });
});
