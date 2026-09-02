/** Tarjeta móvil de /facturacion muestra folio, cliente, vencimiento y monto. */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { FacturaEmitidaMobileCard } from "../FacturaEmitidaMobileCard";
import type { Factura } from "@/features/facturacion/routes/facturacionColumns";

function factura(overrides: Partial<Factura> = {}): Factura {
  return {
    id: "f1",
    numero: "F-0001",
    expediente: "EXP-1",
    cliente_nombre: "cliente uno",
    total: 1000,
    moneda: "MXN",
    fecha_emision: "2024-01-01",
    fecha_vencimiento: "2024-02-01",
    estado: "Emitida",
    factura_pdf_url: null,
    factura_xml_url: null,
    ambiente: "produccion",
    ...overrides,
  } as unknown as Factura;
}

describe("FacturaEmitidaMobileCard", () => {
  it("muestra folio, cliente, vencimiento, estado y monto", () => {
    render(<FacturaEmitidaMobileCard factura={factura()} />);
    expect(screen.getByText("F-0001")).toBeInTheDocument();
    expect(screen.getByText("Cliente Uno")).toBeInTheDocument();
    expect(screen.getByText(/Emitida/)).toBeInTheDocument();
    expect(screen.getByText(/1,000\.00|1000\.00/)).toBeInTheDocument();
  });
});
