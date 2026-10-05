import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CancelarFacturaProveedorDialog } from "../CancelarFacturaProveedorDialog";

describe("Cancelación de registro de proveedor, no del CFDI", () => {
  it("explica el alcance local y la longitud exigida antes de confirmar", () => {
    const onConfirm = vi.fn();
    render(<CancelarFacturaProveedorDialog factura={null} open isPending={false} onOpenChange={vi.fn()} onConfirm={onConfirm} />);
    expect(screen.getByText(/No se solicita la cancelación del CFDI ante el SAT/)).toBeInTheDocument();
    const motivo = screen.getByRole("textbox", { name: /Motivo de cancelación/ });
    expect(motivo).toHaveAccessibleDescription("Mínimo 4 caracteres.");
    fireEvent.change(screen.getByRole("textbox", { name: /Escribe CANCELAR/ }), { target: { value: "CANCELAR" } });
    fireEvent.change(motivo, { target: { value: "abc" } });
    expect(screen.getByRole("button", { name: "Cancelar registro" })).toBeDisabled();
    fireEvent.change(motivo, { target: { value: "  Error de captura  " } });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar registro" }));
    expect(onConfirm).toHaveBeenCalledWith("Error de captura");
  });
});
