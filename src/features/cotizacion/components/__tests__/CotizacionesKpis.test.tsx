/**
 * v13.823.346 — Regresión HD (1280×720): el label del primer KPI se truncaba a
 * "Total cotizaciones (30 ...". El periodo vive ahora en el sublabel.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CotizacionesKpis } from "../CotizacionesKpis";

describe("CotizacionesKpis", () => {
  it("no confunde aceptación comercial con conversión a embarque", () => {
    render(<CotizacionesKpis total={12} aceptadas={5} rechazadas={2} tasa="41.7" />);
    expect(screen.getByText("Tasa de aceptación")).toBeInTheDocument();
    expect(screen.getByText("Aceptadas ÷ total del periodo")).toBeInTheDocument();
    expect(screen.getByText("Incluye cotizaciones en operación")).toBeInTheDocument();
    expect(screen.queryByText("Tasa de conversión")).not.toBeInTheDocument();
  });
  it("muestra el label corto y el periodo como sublabel", () => {
    render(<CotizacionesKpis total={12} aceptadas={5} rechazadas={2} tasa="41.7" />);
    expect(screen.getByText("Total cotizaciones")).toBeTruthy();
    expect(screen.getByText("30 días")).toBeTruthy();
    expect(screen.queryByText(/Total cotizaciones \(30 días\)/)).toBeNull();
  });

  it("presenta cero rechazos con tono neutro", () => {
    const { container } = render(
      <CotizacionesKpis total={4} aceptadas={2} rechazadas={0} tasa="50" />,
    );
    const rechazadas = screen.getByText("Rechazadas").closest("div.border");
    expect(rechazadas).not.toHaveClass("border-destructive/30");
    expect(container.querySelector(".text-destructive")).toBeNull();
  });
});
