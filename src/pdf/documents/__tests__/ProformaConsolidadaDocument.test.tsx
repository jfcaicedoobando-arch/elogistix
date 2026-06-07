import { describe, it, expect, vi } from "vitest";
import { ProformaConsolidadaDocument } from "../ProformaConsolidadaDocument";
import { render } from "@testing-library/react";

const mockProforma = {
  numero: "PROF-CON-001",
  fecha_emision: "2023-01-01",
} as any;

const mockEmbarque = {
  modo: "Marítimo",
} as any;

describe("ProformaConsolidadaDocument", () => {
  it("ProformaConsolidadaDocument renderiza con props mínimas", () => {
    const { getByTestId } = render(
      <ProformaConsolidadaDocument 
        proforma={mockProforma} 
        embarque={mockEmbarque} 
        conceptosConsolidados={[]} 
      />
    );
    expect(getByTestId("pdf-doc")).toBeDefined();
  });

  it("debe renderizar con conceptos consolidados", () => {
    const conceptos = [{ id: "1", descripcion: "Carga", total: 100, moneda: "USD" }] as any;
    const { getByTestId } = render(
      <ProformaConsolidadaDocument 
        proforma={mockProforma} 
        embarque={mockEmbarque} 
        conceptosConsolidados={conceptos} 
      />
    );
    expect(getByTestId("pdf-doc")).toBeDefined();
  });
});
