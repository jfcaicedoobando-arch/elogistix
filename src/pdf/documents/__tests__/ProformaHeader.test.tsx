import { describe, it, expect, vi } from "vitest";
import { ProformaHeader } from "../ProformaHeader";
import { render } from "@testing-library/react";

const mockProforma = {
  numero: "P1",
  fecha_emision: "2023-01-01",
  expediente: "E1",
} as any;

const mockEmbarque = {
  modo: "Marítimo",
} as any;

describe("ProformaHeader", () => {
  it("ProformaHeader renderiza con props mínimas", () => {
    const { getAllByTestId } = render(
      <ProformaHeader 
        proforma={mockProforma} 
        cliente={null as any} 
        embarque={mockEmbarque} 
        esConsolidada={false} 
      />
    );
    expect(getAllByTestId("pdf-text").length).toBeGreaterThan(0);
  });

  it("debe renderizar versión consolidada", () => {
    const { getAllByTestId } = render(
      <ProformaHeader 
        proforma={mockProforma} 
        cliente={null as any} 
        embarque={mockEmbarque} 
        esConsolidada={true} 
      />
    );
    expect(getAllByTestId("pdf-text").length).toBeGreaterThan(0);
  });
});
