import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { DialogCobroLoteResumen } from "../DialogCobroLoteResumen";

describe("Cobro en lote: registro no equivale a REP timbrado", () => {
  it.each([1, 3])("%i REP: solicita el timbrado y explica cómo seguir un pendiente o error", (repRequeridos) => {
    render(<DialogCobroLoteResumen facturas={[]} renglones={[]} moneda="MXN" recibido={116} totalRepartido={116} sinAsignar={0} error={null} repRequeridos={repRequeridos} />);
    const aviso = screen.getByText(/se solicitará su timbrado/);
    expect(aviso).toHaveTextContent(`${repRequeridos} factura${repRequeridos === 1 ? " requiere" : "s requieren"}`);
    expect(aviso).toHaveTextContent(/en proceso.*error.*REP pendientes.*sin registrar otra vez el cobro/);
    expect(aviso).not.toHaveTextContent(/se timbrarán? automáticamente/);
  });

  it("no anuncia un REP si ninguna factura lo requiere", () => {
    render(<DialogCobroLoteResumen facturas={[]} renglones={[]} moneda="MXN" recibido={116} totalRepartido={116} sinAsignar={0} error={null} repRequeridos={0} />);
    expect(screen.queryByText(/REP pendientes/)).not.toBeInTheDocument();
  });
});
