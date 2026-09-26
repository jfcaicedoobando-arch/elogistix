import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { formatCurrency } from "@/lib/formatters";
import { CxpPorPagarKpis } from "../CxpPorPagarKpis";

describe("CxpPorPagarKpis — saldo y moneda", () => {
  it("no repite un saldo exclusivamente MXN ni lo redondea a K", () => {
    render(<CxpPorPagarKpis totalFacturas={1} resumen={{
      saldoMXN: 1160, porMoneda: { MXN: 1160, USD: 0, EUR: 0 }, faltaTipoCambio: 0, vencidas: 0,
    }} />);
    expect(screen.getAllByText(formatCurrency(1160, "MXN"))).toHaveLength(1);
    expect(screen.getByText("Saldo total")).toBeInTheDocument();
    expect(screen.queryByText(/Desglose/)).not.toBeInTheDocument();
    expect(screen.queryByText(/1.2K/)).not.toBeInTheDocument();
  });

  it("distingue el homologado de las monedas originales y conserva el aviso de TC", () => {
    render(<CxpPorPagarKpis totalFacturas={3} resumen={{
      saldoMXN: 35160, porMoneda: { MXN: 1160, USD: 2000, EUR: 872.61 }, faltaTipoCambio: 1, vencidas: 2,
    }} />);
    expect(screen.getByText("Saldo total en MXN")).toBeInTheDocument();
    expect(screen.getByText("Desglose en moneda original:")).toBeInTheDocument();
    for (const [amount, currency] of [[1160, "MXN"], [2000, "USD"], [872.61, "EUR"]] as const) {
      expect(screen.getByText(formatCurrency(amount, currency))).toBeInTheDocument();
    }
    expect(screen.getByText(/1 factura sin TC capturado/)).toBeInTheDocument();
  });
});
