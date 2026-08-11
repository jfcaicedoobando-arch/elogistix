/**
 * Banda de totales del pago en lote a proveedor (v13.498.0).
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { DialogPagoLoteResumen } from "../DialogPagoLoteResumen";

const facturas = [
  { factura_id: "a", folio_proveedor: "FP-1", fecha_vencimiento: "2026-01-10", saldo: 100 },
  { factura_id: "b", folio_proveedor: "FP-2", fecha_vencimiento: "2026-02-10", saldo: 200 },
];

describe("DialogPagoLoteResumen", () => {
  it("cuenta las facturas que quedan liquidadas", () => {
    render(
      <DialogPagoLoteResumen
        facturas={facturas}
        renglones={[{ factura_id: "a", monto: 100 }, { factura_id: "b", monto: 50 }]}
        moneda="MXN"
        totalRepartido={150}
        sinAsignar={0}
        error={null}
      />,
    );
    expect(screen.getByText(/1 de 2 quedan liquidadas/)).toBeInTheDocument();
  });

  it("muestra el error de validación", () => {
    render(
      <DialogPagoLoteResumen
        facturas={facturas}
        renglones={[]}
        moneda="MXN"
        totalRepartido={0}
        sinAsignar={0}
        error="Captura el importe total de la transferencia."
      />,
    );
    expect(screen.getByText(/Captura el importe total/)).toBeInTheDocument();
  });
});
