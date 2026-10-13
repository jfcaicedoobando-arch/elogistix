import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AvanzarEstadoButton } from "../header/AvanzarEstadoButton";

function setup(siguienteEstado = "En Tránsito") {
  const avanzar = vi.fn();
  render(<AvanzarEstadoButton estadoVisual={siguienteEstado === "Confirmado" ? "Borrador" : "Confirmado"}
    siguienteEstado={siguienteEstado} etd="2026-09-15" avanzandoEstado={false}
    bloqueadoPorDocs={false} docsFaltantes={[]} cierreBloqueadoPorChecklist={false}
    onAvanzarEstado={avanzar} onIrACierre={vi.fn()} onIrADocumentos={vi.fn()} />);
  fireEvent.click(screen.getByRole("button", { name: /Avanzar a/i }));
  return avanzar;
}

describe("confirmación explícita de salida real", () => {
  it("abrir o cancelar no registra salida; confirmar llama una vez", () => {
    const avanzar = setup();
    expect(screen.getByRole("alertdialog")).toHaveTextContent("transporte ya salió realmente");
    expect(screen.getByRole("alertdialog")).toHaveTextContent("hora de confirmación");
    expect(avanzar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(avanzar).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Avanzar a/i }));
    fireEvent.click(screen.getByRole("button", { name: "Confirmar salida real" }));
    expect(avanzar).toHaveBeenCalledOnce();
  });
  it("confirmar el embarque sigue siendo una acción separada de confirmar su salida", () => {
    const avanzar = setup("Confirmado");
    expect(screen.queryByText(/transporte ya salió realmente/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    expect(avanzar).toHaveBeenCalledOnce();
  });
});
