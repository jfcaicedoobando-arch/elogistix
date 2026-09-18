import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TratamientoIvaBadge } from "../TratamientoIvaBadge";

describe("TratamientoIvaBadge", () => {
  it.each([
    ["gravado_16", "16%"],
    ["gravado_8", "8%"],
    ["tasa_0", "0%"],
    ["exento", "Exento"],
    ["no_objeto", "No objeto"],
  ])("muestra %s como %s sin importar la moneda", (tipo_iva, etiqueta) => {
    render(<TratamientoIvaBadge concepto={{ tipo_iva }} />);
    expect(screen.getByText(etiqueta)).toBeInTheDocument();
  });

  it("muestra Por confirmar cuando el tratamiento legacy es insuficiente", () => {
    render(<TratamientoIvaBadge concepto={{ aplica_iva: false }} />);
    expect(screen.getByText("Por confirmar")).toBeInTheDocument();
  });
});