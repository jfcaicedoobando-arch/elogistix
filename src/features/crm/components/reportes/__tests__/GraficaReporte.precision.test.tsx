import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GraficaReporte } from "../GraficaReporte";

describe("CRM report preserves numeric display precision", () => {
  it.each<[number, string]>([[-1.5, "USD -2"], [-0.5, "USD -1"]])("preserves the negative half tie %s", (valor, label) => {
    render(<GraficaReporte tipo="numero" datos={[{ etiqueta: "Total", valor }]} medida="suma_monto_usd" />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
  it.each<[number, string]>([[1.2345, "1.235"], [1.2, "1.2"], [1, "1"]])("preserves up to three fractional digits for %s", (valor, label) => {
    render(<GraficaReporte tipo="numero" datos={[{ etiqueta: "Total", valor }]} medida="conteo" />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
});
