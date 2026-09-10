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

/**
 * v13.823.277 — la UI no debe ofrecer acciones que la base de datos rechaza
 * con 42501. Espejo de `aceptar_cotizacion_version` y
 * `crear_embarque_borrador_core`.
 */
describe("CotizacionDetalleAcciones — permisos espejo de las RPC", () => {
  const puedenAceptar = ["gerente_comercial", "vendedor", "gerente_operaciones"] as const;
  const noPuedenAceptar = ["contador", "ejecutivo_pricing", "coordinador_logistico"] as const;

  for (const rol of puedenAceptar) {
    it(`${rol} ve Aceptar en Enviada (la RPC lo autoriza)`, () => {
      renderAcciones({ estado: "Enviada", total: 1500, rol });
      expect(screen.getByRole("button", { name: /aceptar/i })).toBeInTheDocument();
    });
  }

  for (const rol of noPuedenAceptar) {
    it(`${rol} NO ve Aceptar en Enviada (la RPC lo rechazaría)`, () => {
      renderAcciones({ estado: "Enviada", total: 1500, rol });
      expect(screen.queryByRole("button", { name: /aceptar/i })).not.toBeInTheDocument();
    });
  }

  const sinCrearEmbarque = [
    "contador",
    "gerente_comercial",
    "vendedor",
    "ejecutivo_pricing",
    "coordinador_logistico",
    "gerente_operaciones",
  ] as const;

  for (const rol of sinCrearEmbarque) {
    it(`${rol} NO ve Crear embarque en Aceptada (sólo admin/operador/super_admin)`, () => {
      renderAcciones({ estado: "Aceptada", total: 1500, rol });
      expect(screen.queryByRole("button", { name: /crear embarque/i })).not.toBeInTheDocument();
    });
  }

  it("operador sí ve Crear embarque en Aceptada", () => {
    renderAcciones({ estado: "Aceptada", total: 1500, rol: "operador" });
    expect(screen.getByRole("button", { name: /crear embarque/i })).toBeInTheDocument();
  });
});

