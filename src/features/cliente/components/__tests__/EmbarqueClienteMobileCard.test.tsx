import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { EmbarqueClienteMobileCard } from "../EmbarqueClienteMobileCard";
import type { EmbarqueCliente } from "../clienteColumns";

function embarque(overrides: Partial<EmbarqueCliente> = {}): EmbarqueCliente {
  return {
    id: "e1", expediente: "EXP-001", modo: "Marítimo", estado: "En tránsito",
    etd: "2024-01-01", eta: "2024-01-15",
    puerto_origen: "Manzanillo", aeropuerto_origen: null, ciudad_origen: null,
    puerto_destino: "Veracruz", aeropuerto_destino: null, ciudad_destino: null,
    ...overrides,
  };
}

describe("EmbarqueClienteMobileCard", () => {
  it("muestra expediente, ruta y estado", () => {
    render(
      <MemoryRouter>
        <EmbarqueClienteMobileCard e={embarque()} />
      </MemoryRouter>,
    );
    expect(screen.getByText("EXP-001")).toBeInTheDocument();
    expect(screen.getByText(/Manzanillo/)).toBeInTheDocument();
  });
});
