/**
 * Regresión: la moneda leída por IA se puede corregir en el paso 1 y el campo
 * de tipo de cambio sólo aparece cuando la moneda no es MXN.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MonedaDetectadaIaCard } from "../MonedaDetectadaIaCard";

describe("MonedaDetectadaIaCard", () => {
  it("no muestra tipo de cambio en MXN y avisa que los importes no se convierten", () => {
    render(
      <MonedaDetectadaIaCard
        moneda="MXN"
        tc=""
        tcOrigen="vacio"
        onMoneda={vi.fn()}
        onTc={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Moneda de la factura detectada por la IA/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Tipo de cambio a MXN/i)).not.toBeInTheDocument();
    expect(screen.getByText(/los importes no se convierten solos/i)).toBeInTheDocument();
  });

  it("expone el tipo de cambio y el botón DOF cuando la moneda es USD", () => {
    render(
      <MonedaDetectadaIaCard
        moneda="USD"
        tc="17.1092"
        tcOrigen="manual"
        onMoneda={vi.fn()}
        onTc={vi.fn()}
        onObtenerDof={vi.fn()}
      />,
    );
    expect(screen.getByLabelText(/Tipo de cambio a MXN/i)).toHaveValue("17.1092");
    expect(screen.getByRole("button", { name: /Obtener DOF/i })).toBeInTheDocument();
  });

});
