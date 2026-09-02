/**
 * FIX-F964 — la sección de pagos debe avisar cuando la factura dice "Pagada"
 * pero no hay pagos ni notas de crédito que lo respalden.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render as rtlRender, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { ReactElement } from "react";

// v13.823.26: `ResponsiveDataTable` usa `useNavigate`, así que el render de
// prueba necesita un Router.
const render = (ui: ReactElement) => rtlRender(<MemoryRouter>{ui}</MemoryRouter>);
import { FacturaPagosSection } from "../detalle/FacturaPagosSection";

const pagosMock = vi.fn();
const ncMock = vi.fn();

vi.mock("@/features/facturacion/hooks", () => ({
  usePagosFactura: () => pagosMock(),
  useEliminarPagoFactura: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useTimbrarRep: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock("@/features/facturacion/hooks/useSaldoFactura", () => ({
  useNotasCreditoAplicadas: () => ncMock(),
}));
vi.mock("@/hooks/shared", () => ({
  useRegistrarActividad: () => ({ mutate: vi.fn() }),
  // v13.823.26: la tabla de pagos ahora es responsiva y consulta el breakpoint.
  useIsMobile: () => false,
}));

vi.mock("@/features/facturacion/components/DialogPreviewCfdiPdf", () => ({
  DialogPreviewCfdiPdf: () => null,
}));

const baseProps = {
  facturaId: "f-1",
  facturaNumero: "F964",
  totalFactura: 928,
  moneda: "USD",
  canEdit: false,
};

describe("FacturaPagosSection · aviso de inconsistencia", () => {
  beforeEach(() => {
    pagosMock.mockReturnValue({ data: [], isLoading: false });
    ncMock.mockReturnValue({ data: [] });
  });

  it("muestra la alerta cuando el estado es Pagada y no hay respaldo", () => {
    render(<FacturaPagosSection {...baseProps} estadoFactura="Pagada" />);
    expect(screen.getByText("Estado inconsistente")).toBeInTheDocument();
  });

  it("no muestra la alerta cuando la factura está Emitida", () => {
    render(<FacturaPagosSection {...baseProps} estadoFactura="Emitida" />);
    expect(screen.queryByText("Estado inconsistente")).not.toBeInTheDocument();
  });

  it("no muestra la alerta cuando sí existe un pago", () => {
    pagosMock.mockReturnValue({
      data: [{ id: "p1", monto_aplicado_factura: 928, fecha_pago: "2026-07-10", moneda: "USD" }],
      isLoading: false,
    });
    render(<FacturaPagosSection {...baseProps} estadoFactura="Pagada" />);
    expect(screen.queryByText("Estado inconsistente")).not.toBeInTheDocument();
  });
});
