import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FacturaPagosMobileCard } from "../FacturaPagosMobileCard";

describe("FacturaPagosMobileCard", () => {
  it("muestra fecha, forma de pago y monto", () => {
    const qc = new QueryClient();
    render(
      <QueryClientProvider client={qc}>
      <FacturaPagosMobileCard
        row={{
          id: "1",
          fecha_pago: "2026-01-01",
          monto: 500,
          monto_aplicado_factura: 500,
          moneda: "MXN",
          forma_pago: "03",
          referencia: "REF-1",
        }}
        facturaId="f1"
        canEdit={true}
        onEliminar={vi.fn()}
        onPreviewRep={vi.fn()}
      />
      </QueryClientProvider>,
    );
    expect(screen.getByText("REF-1")).toBeInTheDocument();
    expect(screen.getByText(/500\.00/)).toBeInTheDocument();
  });
});
