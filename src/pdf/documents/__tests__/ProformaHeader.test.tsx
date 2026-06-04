import { describe, it, expect, vi } from "vitest";
import React from "react";
import { ProformaHeader } from "../ProformaHeader";
import { render } from "@testing-library/react";

vi.mock("@react-pdf/renderer", async () => {
  const actual = await vi.importActual("@react-pdf/renderer");
  return {
    ...actual as any,
    View: ({ children }: any) => <div data-testid="pdf-view">{children}</div>,
    Text: ({ children }: any) => <div data-testid="pdf-text">{children}</div>,
  };
});

const mockProforma = {
  numero: "P1",
  fecha_emision: "2023-01-01",
  expediente: "E1",
} as any;

const mockEmbarque = {
  modo: "Marítimo",
} as any;

describe("ProformaHeader", () => {
  it("debe renderizar sin errores con props mínimas", () => {
    const { getByTestId } = render(
      <ProformaHeader 
        proforma={mockProforma} 
        cliente={null as any} 
        embarque={mockEmbarque} 
        esConsolidada={false} 
      />
    );
    expect(getByTestId("pdf-text")).toBeDefined();
  });

  it("debe renderizar versión consolidada", () => {
    const { getByTestId } = render(
      <ProformaHeader 
        proforma={mockProforma} 
        cliente={null as any} 
        embarque={mockEmbarque} 
        esConsolidada={true} 
      />
    );
    expect(getByTestId("pdf-text")).toBeDefined();
  });
});
