import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { Receipt } from "lucide-react";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { clickFueraDelDialogo, esperarTickRadix } from "@/test/helpers/dialogOutsideClick";

const baseProps = {
  open: true,
  onOpenChange: () => {},
  icon: Receipt,
  title: "Nueva factura",
  description: "Captura los datos",
  footer: <button type="button">Guardar</button>,
};

describe("<FormDialogShell />", () => {
  it("renderiza title, description y footer", () => {
    render(
      <FormDialogShell {...baseProps}>
        <div>body</div>
      </FormDialogShell>,
    );
    expect(screen.getByText("Nueva factura")).toBeInTheDocument();
    expect(screen.getByText("Captura los datos")).toBeInTheDocument();
    expect(screen.getByText("body")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar" })).toBeInTheDocument();
  });

  it("muestra headerAside cuando se pasa", () => {
    render(
      <FormDialogShell {...baseProps} headerAside={<span>Total: $100</span>}>
        <div />
      </FormDialogShell>,
    );
    expect(screen.getByText("Total: $100")).toBeInTheDocument();
  });

  it("renderiza stepper cuando totalSteps > 1", () => {
    render(
      <FormDialogShell
        {...baseProps}
        stepper={{ step: 2, totalSteps: 3, labels: ["Uno", "Dos", "Tres"] }}
      >
        <div />
      </FormDialogShell>,
    );
    // El stepper etiqueta el paso activo y expone el conteo via aria-label.
    expect(screen.getByLabelText("Paso 2 de 3")).toBeInTheDocument();
    expect(screen.getByText(/Dos/)).toBeInTheDocument();
  });

  it("no renderiza el diálogo cuando open=false", () => {
    render(
      <FormDialogShell {...baseProps} open={false}>
        <div>hidden</div>
      </FormDialogShell>,
    );
    expect(screen.queryByText("hidden")).toBeNull();
  });

  it("EC-13: con isDirty pide confirmación antes de cerrar", () => {
    const onOpenChange = vi.fn();
    render(
      <FormDialogShell {...baseProps} onOpenChange={onOpenChange} isDirty>
        <div>body</div>
      </FormDialogShell>,
    );
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText("¿Descartar los cambios?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Descartar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});

describe("<FormDialogShell /> — cierre por X, Escape y clic exterior", () => {
  it("botón X: con isDirty pide confirmación y no cierra hasta confirmar", () => {
    const onOpenChange = vi.fn();
    render(
      <FormDialogShell {...baseProps} onOpenChange={onOpenChange} isDirty>
        <div>body</div>
      </FormDialogShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText("¿Descartar los cambios?")).toBeInTheDocument();
  });

  it("botón X: sin isDirty cierra directo", () => {
    const onOpenChange = vi.fn();
    render(
      <FormDialogShell {...baseProps} onOpenChange={onOpenChange} isDirty={false}>
        <div>body</div>
      </FormDialogShell>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("¿Descartar los cambios?")).not.toBeInTheDocument();
  });

  it("Escape: sin isDirty cierra directo", () => {
    const onOpenChange = vi.fn();
    render(
      <FormDialogShell {...baseProps} onOpenChange={onOpenChange} isDirty={false}>
        <div>body</div>
      </FormDialogShell>,
    );
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("¿Descartar los cambios?")).not.toBeInTheDocument();
  });

  it("clic exterior: con isDirty pide confirmación y no cierra", async () => {
    const onOpenChange = vi.fn();
    render(
      <FormDialogShell {...baseProps} onOpenChange={onOpenChange} isDirty>
        <div>body</div>
      </FormDialogShell>,
    );
    await esperarTickRadix();
    clickFueraDelDialogo();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.getByText("¿Descartar los cambios?")).toBeInTheDocument();
  });

  it("clic exterior: sin isDirty cierra directo", async () => {
    const onOpenChange = vi.fn();
    render(
      <FormDialogShell {...baseProps} onOpenChange={onOpenChange} isDirty={false}>
        <div>body</div>
      </FormDialogShell>,
    );
    await esperarTickRadix();
    clickFueraDelDialogo();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("EC-13: seguir capturando mantiene el modal abierto (no llama onOpenChange)", () => {
    const onOpenChange = vi.fn();
    render(
      <FormDialogShell {...baseProps} onOpenChange={onOpenChange} isDirty>
        <div>body</div>
      </FormDialogShell>,
    );
    fireEvent.keyDown(document.body, { key: "Escape" });
    fireEvent.click(screen.getByRole("button", { name: "Seguir capturando" }));
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(screen.queryByText("¿Descartar los cambios?")).not.toBeInTheDocument();
  });
});
