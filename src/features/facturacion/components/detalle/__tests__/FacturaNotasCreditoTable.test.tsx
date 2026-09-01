/**
 * @vitest-environment jsdom
 *
 * v13.821.6 (P1-2): el botón "Cancelar NC" debe deshabilitarse mientras
 * `cancellation_status` está en `pending`/`verifying` (el SAT sigue
 * verificando y una segunda cancelación es insegura).
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FacturaNotasCreditoTable, type NotaCreditoRow } from "../FacturaNotasCreditoTable";

function baseNota(overrides: Partial<NotaCreditoRow> = {}): NotaCreditoRow {
  return {
    id: "nc-1",
    folio: "A1",
    serie: "A",
    folio_fiscal: 1,
    fecha_emision: "2024-01-01",
    motivo: "01",
    estado: "Timbrada",
    monto: 100,
    moneda: "MXN",
    pdf_url: null,
    xml_url: null,
    ambiente: "live",
    cancellation_status: null,
    ...overrides,
  };
}

const noop = vi.fn();

describe("FacturaNotasCreditoTable — bloqueo de segunda cancelación", () => {
  it("habilita 'Cancelar NC' cuando no hay cancelación en curso", () => {
    render(
      <FacturaNotasCreditoTable
        notas={[baseNota({ cancellation_status: null })]}
        canEdit
        uuidFacturaOriginal="uuid-orig"
        timbrando={false}
        onTimbrar={noop}
        onEmail={noop}
        onCancelar={noop}
      />
    );
    expect(screen.getByRole("button", { name: "Cancelar NC" })).toBeEnabled();
  });

  it.each(["pending", "verifying"])(
    "deshabilita 'Cancelar NC' cuando cancellation_status es '%s'",
    (status) => {
      render(
        <FacturaNotasCreditoTable
          notas={[baseNota({ cancellation_status: status })]}
          canEdit
          uuidFacturaOriginal="uuid-orig"
          timbrando={false}
          onTimbrar={noop}
          onEmail={noop}
          onCancelar={noop}
        />
      );
      expect(screen.getByRole("button", { name: "Cancelar NC" })).toBeDisabled();
    }
  );
});
