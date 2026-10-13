import { describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
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


describe("NumericInput — procedencia de la captura", () => {
  it.each([0, 18.5, 18.4163])("no emite cambios al enfocar y salir de %s sin editar", (value) => {
    const onChange = vi.fn();
    render(<NumericInput aria-label="Cantidad" value={value} onChange={onChange} decimals />);
    const input = screen.getByLabelText<HTMLInputElement>("Cantidad");
    for (let i = 0; i < 2; i += 1) {
      act(() => input.focus());
      act(() => input.blur());
    }
    expect(input).toHaveValue(value === 0 ? "" : String(value));
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([
    { text: "018.50", numeric: 18.5, normalized: "18.5" },
    { text: ".5", numeric: 0.5, normalized: "0.5" },
    { text: "21", numeric: 21, normalized: "21" },
    { text: "", numeric: 0, normalized: "" },
    { text: ".", numeric: 0, normalized: "" },
  ])("emite la edición $text y normaliza sin volver a emitir en blur", ({ text, numeric, normalized }) => {
    const onChange = vi.fn();
    render(<NumericInput aria-label="Cantidad" value={18.5} onChange={onChange} decimals />);
    const input = screen.getByLabelText<HTMLInputElement>("Cantidad");
    act(() => input.focus());
    fireEvent.change(input, { target: { value: text } });
    expect(onChange).toHaveBeenCalledExactlyOnceWith(numeric);
    act(() => input.blur());
    expect(input).toHaveValue(normalized);
    expect(onChange).toHaveBeenCalledExactlyOnceWith(numeric);
  });

  it("no emite una actualización externa recibida mientras el campo está enfocado", () => {
    const onChange = vi.fn();
    const { rerender } = render(<NumericInput aria-label="Cantidad" value={18.5} onChange={onChange} decimals />);
    const input = screen.getByLabelText<HTMLInputElement>("Cantidad");
    act(() => input.focus());
    rerender(<NumericInput aria-label="Cantidad" value={20.6419} onChange={onChange} decimals />);
    expect(input).toHaveValue("20.6419");
    act(() => input.blur());
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each(["abc", "-21", "18.50001", "1234567890123"])("rechaza %s sin convertir el valor anterior en una captura al salir", (text) => {
    const onChange = vi.fn();
    render(<NumericInput aria-label="Cantidad" value={18.5} onChange={onChange} decimals />);
    const input = screen.getByLabelText<HTMLInputElement>("Cantidad");
    act(() => input.focus());
    fireEvent.change(input, { target: { value: text } });
    act(() => input.blur());
    expect(input).toHaveValue("18.5");
    expect(onChange).not.toHaveBeenCalled();
  });
});
