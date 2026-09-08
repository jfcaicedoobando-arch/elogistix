/**
 * Auditoría CRM v13.823.75 · hallazgo 3 — "Nueva cotización" se veía accionable
 * en un prospecto sin cliente pero no hacía nada al pulsarlo.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { OportunidadDetalleAcciones } from "@/features/crm/components/oportunidadDetalle/OportunidadDetalleAcciones";

const base = {
  crearCotPending: false,
  onEditar: vi.fn(),
  onEliminar: vi.fn(),
  canCotizar: true,
  canGestionar: false,
};

describe("OportunidadDetalleAcciones", () => {
  it("sin cliente el botón queda deshabilitado y explica el motivo", () => {
    const crearCotizacion = vi.fn();
    render(<OportunidadDetalleAcciones {...base} crearCotizacion={crearCotizacion} puedeCotizar={false} motivoNoCotizar="Sólo se puede cotizar una oportunidad abierta con cliente o con un prospecto calificado del CRM." />);
    const btn = screen.getByRole("button", { name: /Nueva cotización/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    fireEvent.click(btn);
    expect(crearCotizacion).not.toHaveBeenCalled();
    expect(screen.getByText(/prospecto calificado del CRM/i)).toBeTruthy();
  });

  it("con cliente el botón cotiza normalmente", () => {
    const crearCotizacion = vi.fn();
    render(<OportunidadDetalleAcciones {...base} crearCotizacion={crearCotizacion} puedeCotizar />);
    const btn = screen.getByRole("button", { name: /Nueva cotización/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    fireEvent.click(btn);
    expect(crearCotizacion).toHaveBeenCalledTimes(1);
  });
});
