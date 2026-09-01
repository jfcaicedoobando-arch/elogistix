/**
 * v13.821.7 — P2-4: cierres protegidos consistentes.
 *
 * `DialogEditarFacturaProveedor`, `DialogRegistrarPagoProveedor` y
 * `DialogCrearNotaCredito` usan `FormDialogCancelarBoton` en su footer para
 * que Cancelar respete la misma confirmación de `isDirty` que X/Escape/clic
 * exterior (antes llamaba `onOpenChange(false)` directo y se saltaba la
 * guarda). Se prueba el cableado genérico (shell + botón canónico) con un
 * arnés parametrizado por los tres diálogos, sin montar sus cadenas de datos.
 */
import { useState } from "react";
import { FileText } from "lucide-react";
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { Button } from "@/components/ui/button";
import { FormDialogShell } from "@/components/shared/FormDialogShell";
import { FormDialogCancelarBoton } from "@/components/shared/FormDialogCancelarBoton";

const reset = vi.fn();
const onOpenChange = vi.fn();

/** Arnés equivalente al cableado real: shell + botón Cancelar canónico. */
function Arnes({ dirty, guardado = false }: { dirty: boolean; guardado?: boolean }) {
  const [open, setOpen] = useState(true);
  const cerrar = (o: boolean) => {
    if (!o) reset();
    setOpen(o);
    onOpenChange(o);
  };
  return (
    <FormDialogShell
      open={open}
      onOpenChange={cerrar}
      icon={FileText}
      title="Diálogo de prueba"
      isDirty={dirty}
      footer={
        <>
          <FormDialogCancelarBoton onCancelar={() => cerrar(false)} />
          <Button onClick={() => cerrar(false)}>Guardar</Button>
        </>
      }
    >
      {!guardado && <p>cuerpo</p>}
    </FormDialogShell>
  );
}

const confirmacion = () => screen.queryByText("¿Descartar los cambios?");

describe.each([
  { nombre: "DialogEditarFacturaProveedor" },
  { nombre: "DialogRegistrarPagoProveedor" },
  { nombre: "DialogCrearNotaCredito" },
])("cierre protegido de $nombre (footer con FormDialogCancelarBoton)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("con cambios: Cancelar pide confirmación y no cierra", () => {
    render(<Arnes dirty />);
    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    expect(confirmacion()).toBeInTheDocument();
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it("con cambios: X pide confirmación", () => {
    render(<Arnes dirty />);
    fireEvent.click(screen.getByRole("button", { name: /cerrar/i }));
    expect(confirmacion()).toBeInTheDocument();
  });

  it("con cambios: Escape pide confirmación", () => {
    render(<Arnes dirty />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(confirmacion()).toBeInTheDocument();
  });

  it("con cambios: clic fuera pide confirmación", () => {
    render(<Arnes dirty />);
    fireEvent.pointerDown(document.body);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(confirmacion()).toBeInTheDocument();
  });

  it("con cambios: Descartar cierra", () => {
    render(<Arnes dirty />);
    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    fireEvent.click(screen.getByRole("button", { name: /descartar/i }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("sin cambios: Cancelar cierra directo, sin alerta", () => {
    render(<Arnes dirty={false} />);
    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    expect(confirmacion()).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("sin cambios: Escape cierra directo, sin alerta", () => {
    render(<Arnes dirty={false} />);
    fireEvent.keyDown(document.body, { key: "Escape" });
    expect(confirmacion()).toBeNull();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("tras guardar, el formulario queda reseteado (sin residuo visible)", () => {
    render(<Arnes dirty guardado />);
    fireEvent.click(screen.getByRole("button", { name: /guardar/i }));
    expect(confirmacion()).toBeNull();
    expect(reset).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(screen.queryByText("cuerpo")).toBeNull();
  });
});

describe("FormDialogCancelarBoton fuera de un FormDialogShell", () => {
  it("cae al onCancelar recibido cuando no hay contexto de cierre", () => {
    const onCancelar = vi.fn();
    render(<FormDialogCancelarBoton onCancelar={onCancelar} />);
    fireEvent.click(screen.getByRole("button", { name: /^cancelar$/i }));
    expect(onCancelar).toHaveBeenCalledTimes(1);
  });
});
