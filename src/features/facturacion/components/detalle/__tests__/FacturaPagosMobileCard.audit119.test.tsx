/** @vitest-environment jsdom */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { FacturaPagosMobileCard } from "../FacturaPagosMobileCard";
import { formatCurrency } from "@/lib/formatters";
vi.mock("../PagoRepCell", () => ({ PagoRepCell: () => null }));
const base = { id: "p1", fecha_pago: "2026-10-05", monto: 20, monto_aplicado_factura: 1, moneda: "MXN", forma_pago: "03" };
const props = { facturaId: "f1", monedaFactura: "USD", canEdit: false, onEliminar: vi.fn(), onCancelarRep: vi.fn(), onPreviewRep: vi.fn() };
describe("AUD119: aplicado en cada tarjeta responsive", () => {
  it("conserva recibido MXN20 y aplicado USD1 sin deducir del pie", () => {
    render(<FacturaPagosMobileCard row={base} {...props} />);
    expect(screen.getByText("Aplicado")).toBeInTheDocument();
    expect(screen.getByText(formatCurrency(20, "MXN"))).toBeInTheDocument();
    expect(screen.getByText(formatCurrency(1, "USD"))).toBeInTheDocument();
  });
  it("un REP anulado muestra aplicado cero y mantiene el importe histórico", () => {
    render(<FacturaPagosMobileCard row={{ ...base, estado_rep: "Cancelado" }} {...props} />);
    expect(screen.getByText("Anulado")).toBeInTheDocument();
    expect(screen.getByText(formatCurrency(20, "MXN"))).toBeInTheDocument();
    expect(screen.getByText(formatCurrency(0, "USD"))).toBeInTheDocument();
  });
});
