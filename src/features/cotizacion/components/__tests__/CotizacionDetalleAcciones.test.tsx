/**
 * Q-04 — El botón "Aceptar" sólo debe verse cuando hay total > 0.
 * Regresión directa al caso reportado: borrador en $0.00 no debe ofrecer aceptar.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

type AccionesProps = Parameters<typeof CotizacionDetalleAcciones>[0];

function renderAcciones(overrides: Pick<AccionesProps, "estado" | "total" | "rol">) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <CotizacionDetalleAcciones {...baseProps} {...overrides} />
      </MemoryRouter>
    </QueryClientProvider>,
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

  it("R-02 — Solicitada ofrece 'Completar cotización'", () => {
    renderAcciones({ estado: "Solicitada", total: 0, rol: "admin" });
    expect(screen.getByRole("button", { name: /completar cotización/i })).toBeInTheDocument();
  });

  it("Aceptada con total en cero no ofrece Crear embarque y explica qué falta", () => {
    renderAcciones({ estado: "Aceptada", total: 0, rol: "admin" });
    expect(screen.queryByRole("button", { name: /crear embarque/i })).not.toBeInTheDocument();
    expect(screen.getByText(/falta capturar los conceptos de venta/i)).toBeInTheDocument();
  });

  it("R-08 — con total en cero explica por qué no se puede enviar", () => {
    renderAcciones({ estado: "Borrador", total: 0, rol: "admin" });
    expect(screen.queryByRole("button", { name: /marcar como enviada/i })).not.toBeInTheDocument();
    expect(screen.getByText(/al menos un concepto con importe/i)).toBeInTheDocument();
  });
});

