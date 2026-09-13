/**
 * v13.823.346 — Regresión HD (1280×720): el label del primer KPI se truncaba a
 * "Total cotizaciones (30 ...". El periodo vive ahora en el sublabel.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CotizacionesKpis } from "../CotizacionesKpis";

describe("CotizacionesKpis", () => {
  it("muestra el label corto y el periodo como sublabel", () => {
    render(<CotizacionesKpis total={12} aceptadas={5} rechazadas={2} tasa="41.7" />);
    expect(screen.getByText("Total cotizaciones")).toBeTruthy();
    expect(screen.getByText("Últimos 30 días")).toBeTruthy();
    expect(screen.queryByText(/Total cotizaciones \(30 días\)/)).toBeNull();
  });
});
