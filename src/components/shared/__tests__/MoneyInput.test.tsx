import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { MoneyInput } from "../MoneyInput";

function Harness({ inicial = 0 }: { inicial?: number }) {
  const [monto, setMonto] = useState(inicial);
  return (
    <>
      <MoneyInput aria-label="Importe" value={monto} onChange={setMonto} currency="MXN" />
      <output>{monto}</output>
    </>
  );
}

const escribir = (input: HTMLElement, valor: string) =>
  fireEvent.change(input, { target: { value: valor } });

describe("MoneyInput", () => {
  it("no muestra un 0 pegajoso cuando el valor es 0", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Importe")).toHaveValue("");
  });

  it("formatea con separador de miles al escribir", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Importe");
    escribir(input, "1234567.5");
    expect(input).toHaveValue("1,234,567.5");
    expect(screen.getByText("1234567.5")).toBeInTheDocument();
  });

  it("acepta coma decimal", () => {
    render(<Harness />);
    escribir(screen.getByLabelText("Importe"), "1234,5");
    expect(screen.getByText("1234.5")).toBeInTheDocument();
  });

  it("se puede borrar por completo y queda en 0", () => {
    render(<Harness inicial={150} />);
    const input = screen.getByLabelText("Importe");
    expect(input).toHaveValue("150");
    escribir(input, "");
    expect(input).toHaveValue("");
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("normaliza a 2 decimales al salir del campo", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Importe");
    escribir(input, "1234.5");
    fireEvent.blur(input);
    expect(input).toHaveValue("1,234.50");
  });

  it("ignora letras y símbolos", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Importe");
    escribir(input, "$1a2b3");
    expect(input).toHaveValue("123");
  });

  it("muestra la moneda como sufijo y usa teclado decimal", () => {
    render(<Harness />);
    expect(screen.getByText("MXN")).toBeInTheDocument();
    expect(screen.getByLabelText("Importe")).toHaveAttribute("inputmode", "decimal");
  });

  it("reporta el número al formulario", () => {
    const onChange = vi.fn();
    render(<MoneyInput aria-label="Monto" value={0} onChange={onChange} />);
    escribir(screen.getByLabelText("Monto"), "99.9");
    expect(onChange).toHaveBeenLastCalledWith(99.9);
  });
});
