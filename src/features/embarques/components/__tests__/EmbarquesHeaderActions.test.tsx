/**
 * Regresión (v13.823.323): cuando la creación directa está bloqueada
 * (política tarifa-first), la CTA de la lista NO puede llamarse
 * "Nuevo embarque" — debe anunciar su destino real ("Ver cotizaciones")
 * y ejecutar la navegación hacia cotizaciones.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { EmbarquesHeaderActions } from "../EmbarquesHeaderActions";

describe("EmbarquesHeaderActions", () => {
  it("sin alta directa muestra 'Ver cotizaciones' y nunca 'Nuevo embarque'", () => {
    const onNuevoDesdeCotizacion = vi.fn();
    render(
      <EmbarquesHeaderActions
        canEdit={false}
        exportandoCsv={false}
        onExport={() => {}}
        onNuevo={() => {}}
        onNuevoDesdeCotizacion={onNuevoDesdeCotizacion}
      />,
    );
    expect(screen.queryByText("Nuevo embarque")).toBeNull();
    const cta = screen.getByRole("button", { name: /ver cotizaciones/i });
    fireEvent.click(cta);
    expect(onNuevoDesdeCotizacion).toHaveBeenCalledTimes(1);
  });

  it("con alta directa conserva el botón 'Nuevo embarque'", () => {
    const onNuevo = vi.fn();
    render(
      <EmbarquesHeaderActions
        canEdit
        exportandoCsv={false}
        onExport={() => {}}
        onNuevo={onNuevo}
      />,
    );
    const cta = screen.getByRole("button", { name: /nuevo embarque/i });
    fireEvent.click(cta);
    expect(onNuevo).toHaveBeenCalledTimes(1);
  });
});
