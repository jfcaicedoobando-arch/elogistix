import { describe, it, expect } from "vitest";
import { ProformaHeader } from "../ProformaHeader";
import { render } from "@testing-library/react";
import { makeProforma, makeEmbarque } from "@/test/fixtures";

const mockProforma = makeProforma({
  numero: "P1",
  fecha_emision: "2023-01-15",
  expediente: "EXP-77",
  cliente_nombre: "Cliente Demo",
  dias_credito: 30,
});

const mockEmbarque = makeEmbarque({
  modo: "Marítimo",
  tipo: "FCL",
  incoterm: "FOB",
  puerto_origen: "Shanghai",
  puerto_destino: "Manzanillo",
} as Partial<ReturnType<typeof makeEmbarque>>);

describe("ProformaHeader", () => {
  it("muestra número, expediente, cliente, modo/incoterm y vigencia", () => {
    const { container } = render(
      <ProformaHeader
        proforma={mockProforma}
        cliente={null}
        embarque={mockEmbarque}
        esConsolidada={false}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("P1");
    expect(text).toContain("EXP-77");
    expect(text).toContain("Cliente Demo");
    expect(text).toContain("Marítimo");
    expect(text).toContain("FOB");
    expect(text).toContain("Shanghai");
    expect(text).toMatch(/sin validez fiscal/i);
  });

  it("versión consolidada incluye datos clave", () => {
    const { container } = render(
      <ProformaHeader
        proforma={mockProforma}
        cliente={null}
        embarque={mockEmbarque}
        esConsolidada={true}
      />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("P1");
    expect(text).toContain("EXP-77");
  });
});
