import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("MoneyInput", () => {
  it("no muestra un 0 pegajoso cuando el valor es 0", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Importe")).toHaveValue("");
  });

  it("formatea con separador de miles al escribir", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("Importe");
    await user.type(input, "1234567.5");
    expect(input).toHaveValue("1,234,567.5");
    expect(screen.getByText("1234567.5")).toBeInTheDocument();
  });

  it("acepta coma decimal", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("Importe");
    await user.type(input, "1234,5");
    expect(screen.getByText("1234.5")).toBeInTheDocument();
  });

  it("se puede borrar por completo y queda en 0", async () => {
    const user = userEvent.setup();
    render(<Harness inicial={150} />);
    const input = screen.getByLabelText("Importe");
    await user.clear(input);
    expect(input).toHaveValue("");
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("normaliza a 2 decimales al salir del campo", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("Importe");
    await user.type(input, "1234.5");
    await user.tab();
    expect(input).toHaveValue("1,234.50");
  });

  it("ignora letras y símbolos", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByLabelText("Importe");
    await user.type(input, "$1a2b3");
    expect(input).toHaveValue("123");
  });

  it("muestra la moneda como sufijo", () => {
    render(<Harness />);
    expect(screen.getByText("MXN")).toBeInTheDocument();
  });

  it("es alcanzable y editable con teclado", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<MoneyInput aria-label="Monto" value={0} onChange={onChange} />);
    await user.tab();
    expect(screen.getByLabelText("Monto")).toHaveFocus();
    await user.keyboard("99");
    expect(onChange).toHaveBeenLastCalledWith(99);
  });
});
