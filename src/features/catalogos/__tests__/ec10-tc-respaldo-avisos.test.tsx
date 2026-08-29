/**
 * EC-10 — las pantallas que convierten a MXN con el tipo de cambio de respaldo
 * (17.25 / 18.5, operativo y NO fiscal) deben avisarlo. Ninguna de estas
 * pantallas persiste dinero, por eso avisamos en lugar de bloquear.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const mockRates = vi.fn();
vi.mock("@/features/catalogos/hooks", () => ({
  useExchangeRates: () => mockRates(),
}));

import { TipoCambioFallbackBanner } from "@/features/dashboard/direccion/components/TipoCambioFallbackBanner";
import { CarteraKpis } from "@/features/bandejas/routes/_sections/CarteraKpis";
import { ProveedorResumenCards } from "@/features/proveedor/components/ProveedorResumenCards";
import { TopProveedoresCard } from "@/features/compras/routes/_sections/TopProveedoresCard";

const FALLBACK = { data: { usdMxn: 17.25, eurMxn: 18.5, esFallback: true } };
const OFICIAL = { data: { usdMxn: 18.9123, eurMxn: 20.5, esFallback: false } };

const carteraProps = {
  totalFacturas: 2,
  saldosNativos: { MXN: 1000, USD: 500, EUR: 0, otras: {} },
  vencidasCount: 1,
  vencidoNativo: { MXN: 0, USD: 500, EUR: 0, otras: {} },
  eqTotal: { totalMxn: 9625, facturasSinTc: 0 },
  eqVencido: { totalMxn: 8625, facturasSinTc: 0 },
};

describe("EC-10 · avisos de tipo de cambio de respaldo", () => {
  beforeEach(() => mockRates.mockReset());

  it("el banner aparece sólo cuando el T/C es de respaldo", () => {
    mockRates.mockReturnValue(FALLBACK);
    const { unmount } = render(<TipoCambioFallbackBanner />);
    expect(screen.getByText("Tipo de cambio estimado")).toBeInTheDocument();
    unmount();

    mockRates.mockReturnValue(OFICIAL);
    render(<TipoCambioFallbackBanner />);
    expect(screen.queryByText("Tipo de cambio estimado")).not.toBeInTheDocument();
  });

  it("Cartera marca el equivalente como estimado con T/C de respaldo", () => {
    mockRates.mockReturnValue(FALLBACK);
    render(<CarteraKpis {...carteraProps} />);
    expect(screen.getAllByText("(T/C estimado)").length).toBeGreaterThan(0);
    expect(screen.getByText("Tipo de cambio estimado")).toBeInTheDocument();
  });

  it("Cartera no marca nada con T/C oficial", () => {
    mockRates.mockReturnValue(OFICIAL);
    render(<CarteraKpis {...carteraProps} />);
    expect(screen.queryByText("(T/C estimado)")).not.toBeInTheDocument();
  });

  it("Proveedor avisa cuando hay varias monedas y T/C de respaldo", () => {
    mockRates.mockReturnValue(FALLBACK);
    render(
      <ProveedorResumenCards
        totalFacturado={1000}
        totalPagado={400}
        totalPendiente={600}
        moneda="MXN"
        operacionesCount={3}
        porMoneda={{ MXN: 500, USD: 30 }}
      />,
    );
    expect(screen.getByText(/T\/C estimado \(no oficial\)/)).toBeInTheDocument();
  });

  it("Proveedor en una sola moneda no muestra aviso", () => {
    mockRates.mockReturnValue(FALLBACK);
    render(
      <ProveedorResumenCards
        totalFacturado={1000}
        totalPagado={400}
        totalPendiente={600}
        moneda="MXN"
        operacionesCount={1}
        porMoneda={{ MXN: 1000 }}
      />,
    );
    expect(screen.queryByText("Tipo de cambio estimado")).not.toBeInTheDocument();
  });

  it("Compras avisa que el orden del ranking es estimado", () => {
    mockRates.mockReturnValue(FALLBACK);
    render(
      <TopProveedoresCard
        isLoading={false}
        rows={[{ nombre: "Naviera X", mxn: 0, usd: 900, eur: 0, count: 2, mxnEquiv: 15525 }]}
      />,
    );
    expect(screen.getByText(/Orden calculado con tipo de cambio estimado/)).toBeInTheDocument();
  });

  it("Compras sin partidas en USD no avisa", () => {
    mockRates.mockReturnValue(FALLBACK);
    render(
      <TopProveedoresCard
        isLoading={false}
        rows={[{ nombre: "Local S.A.", mxn: 5000, usd: 0, eur: 0, count: 1, mxnEquiv: 5000 }]}
      />,
    );
    expect(screen.queryByText(/Orden calculado con tipo de cambio estimado/)).not.toBeInTheDocument();
  });
});
