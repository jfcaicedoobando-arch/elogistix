/**
 * Regresión (auditoría v13.823.143 · bug 6): una tarifa borrador con vigencia
 * vencida no ofrece "Aprobar"; el menú explica actualizar la vigencia.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { TarifaRowActions } from "../TarifaRowActions";

const noop = () => {};

describe("TarifaRowActions · tarifa vencida", () => {
  it("oculta Aprobar/Rechazar y muestra la nota de vigencia", async () => {
    render(
      <TarifaRowActions
        estadoAprobacion="borrador"
        vencida
        onEditar={noop}
        onDuplicar={noop}
        onEliminar={noop}
        onAprobar={vi.fn()}
      />,
    );
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Acciones de tarifa" }),
      { ctrlKey: false, button: 0 },
    );
    await screen.findByText("Editar");
    expect(screen.queryByText("Aprobar")).not.toBeInTheDocument();
    expect(screen.getByText(/Vigencia vencida/i)).toBeInTheDocument();
  });

  it("con vigencia vigente sí ofrece Aprobar", async () => {
    render(
      <TarifaRowActions
        estadoAprobacion="borrador"
        onEditar={noop}
        onDuplicar={noop}
        onEliminar={noop}
        onAprobar={vi.fn()}
      />,
    );
    fireEvent.pointerDown(
      screen.getByRole("button", { name: "Acciones de tarifa" }),
      { ctrlKey: false, button: 0 },
    );
    await screen.findByText("Editar");
    expect(screen.getByText("Aprobar")).toBeInTheDocument();
  });
});
