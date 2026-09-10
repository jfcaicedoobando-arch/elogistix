/**
 * @vitest-environment jsdom
 *
 * v13.823.287 — un pago con REP cancelado queda ANULADO: se marca en la
 * tarjeta y su importe aplicado ya no cuenta. Mientras la cancelación está en
 * trámite ante el SAT se ofrece el refresco manual del estatus.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FacturaPagosMobileCard } from "../FacturaPagosMobileCard";
import { PagoRepCell } from "../PagoRepCell";

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
};

describe("Pago con REP cancelado (anulado)", () => {
  it("marca 'Anulado' en la tarjeta del pago", () => {
    wrap(
      <FacturaPagosMobileCard
        row={{
          id: "p1",
          fecha_pago: "2026-01-01",
          monto: 500,
          monto_aplicado_factura: 500,
          moneda: "MXN",
          forma_pago: "03",
          estado_rep: "Cancelado",
          rep_cancelado_en: "2026-01-05",
          rep_cancellation_status: "accepted",
        }}
        facturaId="f1"
        canEdit={false}
        onEliminar={vi.fn()}
        onCancelarRep={vi.fn()}
        onPreviewRep={vi.fn()}
      />,
    );
    expect(screen.getByText("Anulado")).toBeInTheDocument();
  });

  it("ofrece actualizar el estado ante el SAT cuando la cancelación está en trámite", () => {
    wrap(
      <PagoRepCell
        pagoId="p2"
        facturaId="f1"
        estadoRep="Timbrado"
        serieRep="A"
        folioRep={7}
        cancellationStatus="pending"
        onPreview={vi.fn()}
      />,
    );
    expect(screen.getByText("Cancelación en trámite")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Actualizar estado ante el SAT" }),
    ).toBeInTheDocument();
  });
});
