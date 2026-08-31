/**
 * P2 (v13.819.1) — El botón "Cancelar" del paso 1 del wizard de cotización
 * navegaba al listado sin advertir de la captura pendiente.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { useDirtyGuard } from "@/hooks/shared/useDirtyGuard";
import { ejecutarSalidaWizard } from "../salidaWizard";

function Sujeto({
  dirty,
  currentStep = 1,
  isBusy = false,
  retroceder,
}: { dirty: boolean; currentStep?: number; isBusy?: boolean; retroceder: () => void }) {
  const { guardDialog, confirmarSalida } = useDirtyGuard(dirty);
  return (
    <div>
      <button
        type="button"
        onClick={() => ejecutarSalidaWizard({ currentStep, isBusy, retroceder, confirmarSalida })}
      >
        Cancelar
      </button>
      {guardDialog}
    </div>
  );
}

const montar = (props: Parameters<typeof Sujeto>[0]) =>
  render(
    <BrowserRouter>
      <Sujeto {...props} />
    </BrowserRouter>,
  );

describe("ejecutarSalidaWizard", () => {
  it("sin cambios: Cancelar sale de inmediato, sin diálogo", () => {
    const retroceder = vi.fn();
    montar({ dirty: false, retroceder });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(retroceder).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("¿Salir sin guardar?")).not.toBeInTheDocument();
  });

  it("con cambios: Cancelar pide confirmación antes de salir", async () => {
    const retroceder = vi.fn();
    montar({ dirty: true, retroceder });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.getByText("¿Salir sin guardar?")).toBeInTheDocument());
    expect(retroceder).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Salir sin guardar" }));
    expect(retroceder).toHaveBeenCalledTimes(1);
  });

  it("con cambios: 'Seguir capturando' conserva la captura", async () => {
    const retroceder = vi.fn();
    montar({ dirty: true, retroceder });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() => expect(screen.getByText("¿Salir sin guardar?")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Seguir capturando" }));
    expect(retroceder).not.toHaveBeenCalled();
  });

  it("pasos 2+: 'Anterior' retrocede sin confirmar (no se pierde nada)", () => {
    const retroceder = vi.fn();
    montar({ dirty: true, currentStep: 2, retroceder });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(retroceder).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("¿Salir sin guardar?")).not.toBeInTheDocument();
  });

  it("ocupado (guardando): no hace nada", () => {
    const retroceder = vi.fn();
    montar({ dirty: true, isBusy: true, retroceder });
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(retroceder).not.toHaveBeenCalled();
  });
});
