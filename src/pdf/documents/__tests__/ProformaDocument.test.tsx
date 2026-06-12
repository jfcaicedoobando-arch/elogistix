import { describe, it, expect } from "vitest";
import { ProformaDocument } from "../ProformaDocument";
import { render } from "@testing-library/react";
import { makeProforma, makeEmbarque } from "@/test/fixtures";

const mockProforma = makeProforma({
  numero: "PROF-001",
  fecha_emision: "2023-01-15",
  expediente: "EXP-2024-99",
  cliente_nombre: "Acme Corp",
  subtotal_usd: 100,
  iva_usd: 16,
  total_usd: 116,
  subtotal_mxn: 0,
  iva_mxn: 0,
  total_mxn: 0,
});

const mockEmbarque = makeEmbarque({
  modo: "Marítimo",
  tipo: "Importación",
  incoterm: "FOB",
  puerto_origen: "Shanghai",
  puerto_destino: "Manzanillo",
  descripcion_mercancia: "Carga seca general",
});

const mockConcepto = {
  descripcion: "Flete marítimo Shanghai-Manzanillo",
  moneda: "USD",
  cantidad: 1,
  precio_unitario: 100,
  subtotal: 100,
  aplica_iva: true,
} as unknown as Parameters<typeof ProformaDocument>[0]["conceptos"][number];

describe("ProformaDocument", () => {
  it("muestra número, expediente, cliente, modo y puertos en el documento", () => {
    const { container, getByTestId } = render(
      <ProformaDocument proforma={mockProforma} embarque={mockEmbarque} conceptos={[mockConcepto]} />,
    );
    const text = container.textContent ?? "";
    expect(getByTestId("pdf-doc")).toBeInTheDocument();
    expect(text).toContain("PROF-001");
    expect(text).toContain("EXP-2024-99");
    expect(text).toContain("Acme Corp");
    expect(text).toContain("Marítimo");
    expect(text).toContain("FCL");
    expect(text).toContain("Shanghai");
    expect(text).toContain("Manzanillo");
    expect(text).toContain("Carga seca general");
  });

  it("renderiza concepto y aviso 'sin validez fiscal'", () => {
    const { container } = render(
      <ProformaDocument proforma={mockProforma} embarque={mockEmbarque} conceptos={[mockConcepto]} />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Flete marítimo Shanghai-Manzanillo");
    expect(text).toMatch(/sin validez fiscal/i);
  });
});
