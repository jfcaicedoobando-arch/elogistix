/**
 * Q-04 — El botón "Aceptar" sólo debe verse cuando hay total > 0.
 * Regresión directa al caso reportado: borrador en $0.00 no debe ofrecer aceptar.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CotizacionDetalleAcciones } from "@/features/cotizacion/components/CotizacionDetalleSecciones";

const baseProps = {
  esProspecto: false,
  numContenedores: 1,
  cotizacionId: "c1",
  version: 1,
  tieneEmbarquesVinculados: false,
  onCambiarEstado: vi.fn(),
  onAbrirConvertir: vi.fn(),
};

function renderAcciones(overrides: Partial<Parameters<typeof CotizacionDetalleAcciones>[0]>) {
  return render(
    <MemoryRouter>
      <CotizacionDetalleAcciones {...baseProps} {...overrides} />
    </MemoryRouter>,
  );
}

describe("CotizacionDetalleAcciones", () => {
  it("Borrador con total $0.00 no muestra el botón Aceptar", () => {
    renderAcciones({ estado: "Borrador", total: 0, rol: "admin" });
    expect(screen.queryByRole("button", { name: /aceptar/i })).not.toBeInTheDocument();
  });

  it("Enviada con total > 0 sí muestra el botón Aceptar", () => {
    renderAcciones({ estado: "Enviada", total: 1500, rol: "admin" });
    expect(screen.getByRole("button", { name: /aceptar/i })).toBeInTheDocument();
  });
});
