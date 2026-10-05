import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NotaCreditoImporte } from "@/components/shared/NotaCreditoImporte";
import { NotaCreditoFila } from "../NotaCreditoFila";
import type { NotaCreditoProveedor } from "@/features/cxp/types";

vi.mock("../NcSatBadge", () => ({ NcSatBadge: () => null }));

describe("58: importe y equivalente explican el saldo multimoneda", () => {
  it("muestra la NC MXN2000, TC guardados y USD100 aplicado", () => {
    render(<NotaCreditoImporte nota={{ monto: 2000, moneda: "MXN", tipo_cambio: 20 }} factura={{ moneda: "USD", tipo_cambio_usd: 20 }} estado="Aplicada" />);
    expect(screen.getByText(/MXN.*2,000.00/)).toBeInTheDocument();
    expect(screen.getByText(/TC NC: 20/)).toBeInTheDocument();
    expect(screen.getByText(/TC factura \(referencia\): 20/)).toBeInTheDocument();
    expect(screen.getByText("Factura: USD")).toBeInTheDocument();
    expect(screen.getByText(/Aplicado:.*USD.*100.00/)).toBeInTheDocument();
  });
  it("una NC sin aplicar se etiqueta equivalente, no aplicado", () => {
    render(<NotaCreditoImporte nota={{ monto: 10, moneda: "USD", tipo_cambio: 20 }} factura={{ moneda: "MXN", tipo_cambio_usd: 1 }} estado="Borrador" />);
    expect(screen.getByText(/Equivalente:.*MXN.*200.00/)).toBeInTheDocument();
    expect(screen.queryByText(/Aplicado:/)).not.toBeInTheDocument();
  });
  it("sin TC histórico no muestra conversión ficticia", () => {
    render(<NotaCreditoImporte nota={{ monto: 2000, moneda: "MXN", tipo_cambio: null }} factura={{ moneda: "USD", tipo_cambio_usd: 20 }} estado="Aplicada" />);
    expect(screen.getByText(/Equivalente no disponible/)).toBeInTheDocument();
    expect(screen.queryByText(/Aplicado:/)).not.toBeInTheDocument();
  });
  it("usa el TC25 de la NC y muestra USD80, independientemente del TC20 de factura", () => {
    render(<NotaCreditoImporte nota={{ monto: 2000, moneda: "MXN", tipo_cambio: 25 }} factura={{ moneda: "USD", tipo_cambio_usd: 20 }} estado="Aplicada" />);
    expect(screen.getByText(/Aplicado:.*USD.*80.00/)).toBeInTheDocument();
    expect(screen.getByText(/TC NC: 25/)).toBeInTheDocument();
  });
  it("la ficha utiliza el contexto de factura recuperado al recargar la NC", () => {
    const nota = {
      id: "nc1", folio_nc: "BON-1", fecha: "2026-10-04", monto: 2000,
      moneda: "MXN", tipo_cambio: 20, motivo: "Descuento", estado: "Aplicada",
      proveedor_facturas: { moneda: "USD", tipo_cambio_usd: 20 },
    } as NotaCreditoProveedor;
    render(<table><tbody><NotaCreditoFila nota={nota} facturaId="f1" canEdit={false}
      pendingAprobar={false} pendingAplicar={false} pendingCancelar={false}
      onAbrirArchivo={vi.fn()} onAprobar={vi.fn()} onAplicar={vi.fn()} onCancelar={vi.fn()}
    /></tbody></table>);
    expect(screen.getByText(/Aplicado:.*USD.*100.00/)).toBeInTheDocument();
    expect(screen.getByText(/TC NC: 20/)).toBeInTheDocument();
  });
});
