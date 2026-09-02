import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CotizacionClienteMobileCard } from "../CotizacionClienteMobileCard";
import type { CotizacionCliente } from "../clienteColumns";

function cotizacion(overrides: Partial<CotizacionCliente> = {}): CotizacionCliente {
  return {
    id: "c1", folio: "COT-001", modo: "Aéreo", estado: "Enviada",
    origen: "CDMX", destino: "Monterrey", subtotal: 1000, moneda: "MXN",
    created_at: "2024-01-01",
    ...overrides,
  };
}

describe("CotizacionClienteMobileCard", () => {
  it("muestra folio, ruta y subtotal", () => {
    render(
      <MemoryRouter>
        <CotizacionClienteMobileCard c={cotizacion()} />
      </MemoryRouter>,
    );
    expect(screen.getByText("COT-001")).toBeInTheDocument();
    expect(screen.getByText(/CDMX/)).toBeInTheDocument();
    expect(screen.getByText(/1,000\.00|1000\.00/)).toBeInTheDocument();
  });
});
