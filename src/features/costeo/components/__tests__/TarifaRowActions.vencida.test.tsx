/**
 * Regresión (auditoría v13.823.143 · bug 6): una tarifa borrador con vigencia
 * vencida no ofrece "Aprobar"; el menú explica actualizar la vigencia.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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
    await userEvent.click(screen.getByRole("button", { name: "Acciones de tarifa" }));
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
    await userEvent.click(screen.getByRole("button", { name: "Acciones de tarifa" }));
    expect(screen.getByText("Aprobar")).toBeInTheDocument();
  });
});
