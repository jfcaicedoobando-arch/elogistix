import { describe, it, expect, vi } from "vitest";
import React from "react";
import { ProformaDocument } from "../ProformaDocument";
import { render } from "@testing-library/react";

vi.mock("@react-pdf/renderer", async () => {
  const actual = await vi.importActual("@react-pdf/renderer");
  return {
    ...actual as any,
    Document: ({ children }: any) => <div data-testid="pdf-doc">{children}</div>,
    Page: ({ children }: any) => <div data-testid="pdf-page">{children}</div>,
    View: ({ children }: any) => <div data-testid="pdf-view">{children}</div>,
    Text: ({ children }: any) => <div data-testid="pdf-text">{children}</div>,
  };
});

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
  it("debe renderizar sin errores con props mínimas", () => {
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
