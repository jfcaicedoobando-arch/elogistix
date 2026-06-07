import { describe, it, expect, vi } from "vitest";
import { ProformaDocument } from "../ProformaDocument";
import { render } from "@testing-library/react";

const mockProforma = {
  numero: "PROF-001",
  fecha_emision: "2023-01-01",
  subtotal_usd: 100,
  iva_usd: 16,
  total_usd: 116,
} as any;

const mockEmbarque = {
  modo: "Marítimo",
  tipo: "FCL",
  incoterm: "FOB",
} as any;

describe("ProformaDocument", () => {
  it("ProformaDocument renderiza con props mínimas", () => {
    const { getByTestId } = render(
      <ProformaDocument proforma={mockProforma} embarque={mockEmbarque} conceptos={[]} />
    );
    expect(getByTestId("pdf-doc")).toBeDefined();
  });

  it("debe manejar lista de conceptos vacía", () => {
    const { getByTestId } = render(
      <ProformaDocument proforma={mockProforma} embarque={mockEmbarque} conceptos={[]} />
    );
    expect(getByTestId("pdf-doc")).toBeDefined();
  });
});
