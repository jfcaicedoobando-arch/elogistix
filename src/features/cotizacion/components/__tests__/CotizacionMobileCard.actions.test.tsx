import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CotizacionMobileCard } from "../CotizacionMobileCard";

function card(overrides: Record<string, unknown> = {}) {
  const props = {
    folio: "COT-001", clienteNombre: "Cliente", createdAt: "2026-09-24",
    estado: "Borrador", subtotales: [{ moneda: "MXN", monto: 100 }],
    ...overrides,
  };
  return render(<CotizacionMobileCard {...props} />);
}

describe("CotizacionMobileCard acciones", () => {
  it("oculta el menú sin permisos", () => {
    card();
    expect(screen.queryByRole("button", { name: /Acciones para/i })).not.toBeInTheDocument();
  });

  it("expone duplicar y eliminar con teclado y callbacks existentes", () => {
    const onDuplicar = vi.fn();
    const onEliminar = vi.fn();
    card({ canDuplicar: true, canEliminar: true, onDuplicar, onEliminar });
    const trigger = screen.getByRole("button", { name: "Acciones para COT-001" });
    trigger.focus();
    fireEvent.keyDown(trigger, { key: "Enter" });
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicar" }));
    expect(onDuplicar).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(trigger);
    fireEvent.click(screen.getByRole("menuitem", { name: "Eliminar" }));
    expect(onEliminar).toHaveBeenCalledTimes(1);
  });
});