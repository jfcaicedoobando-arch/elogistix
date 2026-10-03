import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { NumericInput } from "../NumericInput";

function Harness({ decimals = true, maxDecimals = 6 } = {}) {
  const [value, setValue] = useState(1);
  return <>
    <NumericInput aria-label="Cantidad" value={value} onChange={setValue}
      decimals={decimals} maxDecimals={maxDecimals} />
    <output aria-label="Valor capturado">{value}</output>
  </>;
}

describe("NumericInput — precisión del campo", () => {
  it("conserva el punto intermedio y normaliza una cantidad fraccionaria", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Cantidad");
    for (const value of ["", ".", ".5"]) {
      fireEvent.change(input, { target: { value } });
      expect(input).toHaveValue(value);
    }
    fireEvent.blur(input);
    expect(input).toHaveValue("0.5");
    expect(screen.getByLabelText("Valor capturado")).toHaveTextContent("0.5");
  });

  it("acepta seis decimales y rechaza un séptimo sin alterar la captura", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Cantidad");
    fireEvent.change(input, { target: { value: "0.000001" } });
    expect(input).toHaveValue("0.000001");
    fireEvent.change(input, { target: { value: "0.0000017" } });
    expect(input).toHaveValue("0.000001");
    expect(screen.getByLabelText("Valor capturado")).toHaveTextContent("0.000001");
  });

  it("conserva el límite de cuatro decimales para campos existentes", () => {
    render(<Harness maxDecimals={4} />);
    const input = screen.getByLabelText("Cantidad");
    fireEvent.change(input, { target: { value: "1.2345" } });
    fireEvent.change(input, { target: { value: "1.23456" } });
    expect(input).toHaveValue("1.2345");
  });

  it("mantiene la captura entera cuando no se habilitan decimales", () => {
    render(<Harness decimals={false} />);
    const input = screen.getByLabelText("Cantidad");
    fireEvent.change(input, { target: { value: "1.5" } });
    expect(input).toHaveValue("1");
    fireEvent.change(input, { target: { value: "25" } });
    expect(input).toHaveValue("25");
  });
});
