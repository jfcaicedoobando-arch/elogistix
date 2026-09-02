import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FacturaNotasCreditoMobileCard } from "../FacturaNotasCreditoMobileCard";
import type { NotaCreditoRow } from "../FacturaNotasCreditoTable";

function nota(overrides: Partial<NotaCreditoRow> = {}): NotaCreditoRow {
  return {
    id: "1", folio: "NC-1", serie: "NC", folio_fiscal: 1,
    fecha_emision: "2026-01-01", motivo: "Descuento", estado: "Timbrada",
    monto: 200, moneda: "MXN", pdf_url: null, xml_url: null, ambiente: "live",
    ...overrides,
  };
}

describe("FacturaNotasCreditoMobileCard", () => {
  it("muestra folio, motivo y monto", () => {
    render(
      <FacturaNotasCreditoMobileCard
        row={nota()}
        canEdit={true}
        uuidFacturaOriginal="uuid-1"
        timbrando={false}
        onTimbrar={vi.fn()}
        onEmail={vi.fn()}
        onCancelar={vi.fn()}
        onPreview={vi.fn()}
      />,
    );
    expect(screen.getByText("Descuento")).toBeInTheDocument();
    expect(screen.getByText(/200\.00/)).toBeInTheDocument();
  });
});
