import { describe, it, expect } from "vitest";
import { ProformaConsolidadaDocument } from "../ProformaConsolidadaDocument";
import { render } from "@testing-library/react";

const mockProforma = {
  numero: "PROF-CON-001",
  fecha_emision: "2023-01-01",
  expediente: "EXP-CON-1",
  cliente_nombre: "Cliente Consolidado",
  notas: "Nota consolidada",
} as any;

const mockEmbarque = {
  modo: "Marítimo",
  tipo: "FCL",
  incoterm: "FOB",
} as any;

describe("ProformaConsolidadaDocument", () => {
  it("muestra número, expediente, cliente y leyendas clave", () => {
    const { container } = render(
      <ProformaConsolidadaDocument
        proforma={mockProforma}
        embarque={mockEmbarque}
        conceptosConsolidados={[]}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("PROF-CON-001");
    expect(text).toContain("EXP-CON-1");
    expect(text).toContain("Cliente Consolidado");
    expect(text).toContain("Conceptos por Contenedor");
    expect(text).toContain("Nota consolidada");
  });

  it("renderiza concepto consolidado en su moneda", () => {
    const conceptos = [{
      id: "1",
      descripcion: "Flete FCL 40HC",
      cantidad: 1,
      precio_unitario: 5000,
      subtotal: 5000,
      total: 5000,
      moneda: "USD",
      contenedor: "MSCU-1234567",
    }] as any;
    const { container } = render(
      <ProformaConsolidadaDocument
        proforma={mockProforma}
        embarque={mockEmbarque}
        conceptosConsolidados={conceptos}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Flete FCL 40HC");
    expect(text).toContain("USD");
  });
});
