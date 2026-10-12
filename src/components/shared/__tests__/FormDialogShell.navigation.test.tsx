import { useState } from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { Receipt } from "lucide-react";
import { describe, expect, it, vi } from "vitest";
import { FormDialogCancelarBoton } from "../FormDialogCancelarBoton";
import { FormDialogShell } from "../FormDialogShell";

type CloseRequest = "X" | "Escape" | "Cancelar";
type Gates = { busy?: boolean; suppressDiscardConfirmation?: boolean };
const closeRequests: CloseRequest[] = ["X", "Escape", "Cancelar"];
const reference = "AUD2-UX-BACK-0310";

function CaptureFixture({
  onOpenChange,
  onCancelar,
  ...gates
}: Gates & { onOpenChange: (open: boolean) => void; onCancelar: () => void }) {
  const [open, setOpen] = useState(true);
  const [folio, setFolio] = useState("");
  return (
    <FormDialogShell
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        setOpen(next);
        if (!next) setFolio("");
      }}
      icon={Receipt}
      title="Captura protegida"
      description="Datos del formulario"
      isDirty={Boolean(folio)}
      footer={<FormDialogCancelarBoton onCancelar={onCancelar} />}
      {...gates}
    >
      <label htmlFor="folio-protegido">Folio</label>
      <input id="folio-protegido" value={folio} onChange={(event) => setFolio(event.target.value)} />
    </FormDialogShell>
  );
}

function mount(gates: Gates = {}) {
  const onOpenChange = vi.fn();
  const onCancelar = vi.fn();
  const tree = (next: Gates) => (
    <CaptureFixture {...next} onOpenChange={onOpenChange} onCancelar={onCancelar} />
  );
  const view = render(tree(gates));
  return { onOpenChange, onCancelar, setGates: (next: Gates) => view.rerender(tree(next)) };
}

function capture() {
  fireEvent.change(screen.getByLabelText("Folio"), { target: { value: reference } });
}

function requestClose(request: CloseRequest) {
  if (request === "Escape") fireEvent.keyDown(document.body, { key: "Escape" });
  else fireEvent.click(screen.getByRole("button", { name: request === "X" ? "Cerrar" : "Cancelar" }));
}

function expectPreserved() {
  expect(screen.getByLabelText("Folio")).toHaveValue(reference);
  expect(screen.getByText("Captura protegida")).toBeInTheDocument();
}

function discard() {
  const alerts = screen.getAllByRole("alertdialog");
  expect(alerts).toHaveLength(1);
  fireEvent.click(within(alerts[0]).getByRole("button", { name: "Descartar" }));
}

describe("FormDialogShell: prioridad de otra confirmación de salida", () => {
  it.each(closeRequests)("consume el aviso de %s al suprimirlo y no lo resucita", (request) => {
    const fixture = mount();
    capture();
    requestClose(request);
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);

    fixture.setGates({ suppressDiscardConfirmation: true });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expectPreserved();
    for (const closing of closeRequests) requestClose(closing);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(fixture.onOpenChange).not.toHaveBeenCalled();
    expect(fixture.onCancelar).not.toHaveBeenCalled();

    fixture.setGates({ suppressDiscardConfirmation: false });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expectPreserved();
    requestClose(request);
    discard();
    expect(fixture.onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(screen.queryByLabelText("Folio")).not.toBeInTheDocument();
  });

  it.each(closeRequests.flatMap((request) => [
    { request, dirty: false }, { request, dirty: true },
  ]))("bloquea $request con supresión inicial y captura=$dirty", ({ request, dirty }) => {
    const fixture = mount({ suppressDiscardConfirmation: true });
    if (dirty) capture();
    requestClose(request);
    expect(fixture.onOpenChange).not.toHaveBeenCalled();
    expect(fixture.onCancelar).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Folio")).toHaveValue(dirty ? reference : "");

    fixture.setGates({ suppressDiscardConfirmation: false });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    requestClose(request);
    if (dirty) discard();
    expect(fixture.onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });

  it("permite repetir interrupciones y continuar sin acumular confirmaciones", () => {
    const fixture = mount();
    capture();
    for (const request of closeRequests) {
      requestClose(request);
      expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
      fixture.setGates({ suppressDiscardConfirmation: true });
      fixture.setGates({ suppressDiscardConfirmation: false });
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expectPreserved();
      requestClose(request);
      fireEvent.click(screen.getByRole("button", { name: "Seguir capturando" }));
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expectPreserved();
    }
    expect(fixture.onOpenChange).not.toHaveBeenCalled();
    expect(fixture.onCancelar).not.toHaveBeenCalled();
    requestClose("Cancelar");
    discard();
    expect(fixture.onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });
});

describe("FormDialogShell: operación iniciada con el aviso abierto", () => {
  it.each(closeRequests)("Descartar después de %s no cierra si busy pasa a true", (request) => {
    const fixture = mount();
    capture();
    requestClose(request);
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
    fixture.setGates({ busy: true });
    expect(screen.getByLabelText("Folio").closest('[role="dialog"]')).toHaveAttribute("aria-busy", "true");
    discard();
    expect(fixture.onOpenChange).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expectPreserved();
    for (const closing of closeRequests) requestClose(closing);
    expect(fixture.onOpenChange).not.toHaveBeenCalled();
    expect(fixture.onCancelar).not.toHaveBeenCalled();
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    fixture.setGates({ busy: false });
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expectPreserved();
    requestClose(request);
    discard();
    expect(fixture.onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
  });
});

describe("FormDialogShell: comportamiento predeterminado sin supresión", () => {
  it.each(closeRequests)("%s pide un aviso, continuar conserva y descartar cierra una vez", (request) => {
    const fixture = mount();
    capture();
    requestClose(request);
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "Seguir capturando" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(fixture.onOpenChange).not.toHaveBeenCalled();
    expectPreserved();
    requestClose(request);
    discard();
    expect(fixture.onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(fixture.onCancelar).not.toHaveBeenCalled();
    expect(screen.queryByLabelText("Folio")).not.toBeInTheDocument();
  });

  it.each(closeRequests)("%s sin captura cierra directamente", (request) => {
    const fixture = mount();
    requestClose(request);
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(fixture.onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(fixture.onCancelar).not.toHaveBeenCalled();
  });
});
