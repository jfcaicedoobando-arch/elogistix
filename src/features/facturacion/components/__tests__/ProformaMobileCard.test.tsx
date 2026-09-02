/** Tarjeta móvil del tab Proformas muestra folio, cliente, fecha y estado. */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProformaMobileCard } from "../ProformaMobileCard";
import type { ProformaConFactura } from "@/features/embarques/hooks";

function proforma(overrides: Partial<ProformaConFactura> = {}): ProformaConFactura {
  return {
    id: "p1",
    numero: "P-0001",
    expediente: "EXP-1",
    cliente_nombre: "cliente dos",
    operador: null,
    fecha_emision: "2024-01-05",
    estado_proforma: "pendiente",
    estado_cliente: "pendiente",
    ...overrides,
  } as unknown as ProformaConFactura;
}

describe("ProformaMobileCard", () => {
  it("muestra folio, cliente, fecha y estado", () => {
    render(<ProformaMobileCard proforma={proforma()} />);
    expect(screen.getByText("P-0001")).toBeInTheDocument();
    expect(screen.getByText("Cliente Dos")).toBeInTheDocument();
    expect(screen.getByText(/Pendiente/i)).toBeInTheDocument();
  });
});
