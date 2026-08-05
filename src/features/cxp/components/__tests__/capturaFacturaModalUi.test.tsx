/**
 * Pruebas del selector de origen y del hint de pendientes del modal
 * "Capturar factura de proveedor" (v13.422.0).
 */
import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { OrigenDocumentoPicker } from "../OrigenDocumentoPicker";
import { pendientesDeCaptura, PendientesGuardarHint } from "../PendientesGuardarHint";
import type { FacturaFormValues } from "@/features/cxp/types";

const values: FacturaFormValues = {
  provId: "",
  provNombre: "",
  folio: "",
  emision: "2026-08-01",
  diasCredito: 0,
  vencimiento: "2026-08-01",
  moneda: "MXN",
  tc: "",
  subtotal: "0",
  iva: "0",
  ieps: "0",
  retenciones: "0",
  categoriaId: "",
  notas: "",
};

describe("OrigenDocumentoPicker", () => {
  it("marca la opción activa y avisa el cambio", () => {
    const onModeChange = vi.fn();
    render(<OrigenDocumentoPicker mode="manual" onModeChange={onModeChange} />);

    const manual = screen.getByRole("radio", { name: /capturar a mano/i });
    expect(manual).toHaveAttribute("aria-checked", "true");

    fireEvent.click(screen.getByRole("radio", { name: /xml del cfdi/i }));
    expect(onModeChange).toHaveBeenCalledWith("cfdi");
  });
});

describe("pendientesDeCaptura", () => {
  it("lista proveedor, folio e importe faltantes", () => {
    expect(pendientesDeCaptura({ values, total: 0 })).toEqual([
      "Falta el proveedor",
      "Falta el folio del proveedor",
      "Falta el importe de la factura",
    ]);
  });

  it("exige tipo de cambio en moneda extranjera", () => {
    const usd: FacturaFormValues = {
      ...values, provId: "p1", folio: "A-1", moneda: "USD", subtotal: "100",
    };
    expect(pendientesDeCaptura({ values: usd, total: 116 })).toEqual([
      "Falta el tipo de cambio",
    ]);
  });

  it("sin pendientes no renderiza nada", () => {
    const ok: FacturaFormValues = { ...values, provId: "p1", folio: "A-1" };
    const { container } = render(<PendientesGuardarHint values={ok} total={116} />);
    expect(container).toBeEmptyDOMElement();
  });
});
