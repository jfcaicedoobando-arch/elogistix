/**
 * P2 (v13.819.1) — El botón "Cancelar" del footer llamaba `onOpenChange(false)`
 * directo y se saltaba la guarda `isDirty` del shell (pérdida de captura, p.ej.
 * en portal agente → Nueva tarifa con Notas capturadas).
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tag } from "lucide-react";
import { FormDialogShell } from "../FormDialogShell";
import { BotonCancelarTarifa } from "@/features/costeo/components/TarifaFormCancelar";

function montar(isDirty: boolean, onOpenChange: (v: boolean) => void) {
  return render(
    <FormDialogShell
      open
      onOpenChange={onOpenChange}
      icon={Tag}
      title="Nueva tarifa"
      isDirty={isDirty}
      footer={<BotonCancelarTarifa disabled={false} onCerrarSinGuarda={() => onOpenChange(false)} />}
    >
      <p>cuerpo</p>
    </FormDialogShell>,
  );
}

describe("FormDialogShell · Cancelar respeta isDirty", () => {
  it("sin captura, Cancelar cierra de inmediato", () => {
    const onOpenChange = vi.fn();
    montar(false, onOpenChange);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("¿Descartar los cambios?")).not.toBeInTheDocument();
  });

  it("con captura, Cancelar pide confirmación y sólo cierra al descartar", async () => {
    const onOpenChange = vi.fn();
    montar(true, onOpenChange);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() =>
      expect(screen.getByText("¿Descartar los cambios?")).toBeInTheDocument(),
    );
    expect(onOpenChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("con captura, 'Seguir capturando' no cierra", async () => {
    const onOpenChange = vi.fn();
    montar(true, onOpenChange);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    await waitFor(() =>
      expect(screen.getByText("¿Descartar los cambios?")).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole("button", { name: "Seguir capturando" }));
    expect(onOpenChange).not.toHaveBeenCalled();
  });
});
