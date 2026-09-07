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

  // R170-01: una proforma convertida cuya única factura sigue en Borrador
  // (sin UUID fiscal) no debe leerse como "Facturada".
  it("no muestra 'Facturada' cuando la única factura asociada está en Borrador", () => {
    render(
      <ProformaMobileCard
        proforma={proforma({
          estado_proforma: "facturada",
          factura_id: "f1",
          facturas_asociadas: [{ id: "f1", estado: "borrador", uuid_fiscal: null, deleted_at: null }],
        })}
      />,
    );
    expect(screen.getByText("Convertida a borrador")).toBeInTheDocument();
    expect(screen.queryByText("Facturada")).not.toBeInTheDocument();
  });
});
