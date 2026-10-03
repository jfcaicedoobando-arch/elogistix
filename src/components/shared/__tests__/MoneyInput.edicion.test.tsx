import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { MoneyInput } from "../MoneyInput";

function Harness({ inicial = 0, allowNegative = false }: { inicial?: number; allowNegative?: boolean }) {
  const [monto, setMonto] = useState(inicial);
  return <>
    <MoneyInput aria-label="Importe" value={monto} onChange={setMonto} allowNegative={allowNegative} />
    <output aria-label="Monto capturado">{monto}</output>
  </>;
}

describe("MoneyInput - edición de separadores automáticos", () => {
  it.each(["insertFromPaste", "insertText", ""])(
    "conserva los miles al pegar un dígito junto a una coma existente (%s)",
    (inputType) => {
      render(<Harness inicial={1000} />);
      const input = screen.getByLabelText("Importe") as HTMLInputElement;
      input.setSelectionRange(2, 2);
      fireEvent.paste(input, { clipboardData: { getData: () => "5" } });
      fireEvent.input(input, { target: { value: "1,5000", selectionStart: 3 }, inputType });
      expect(input).toHaveValue("15,000");
      expect(screen.getByLabelText("Monto capturado")).toHaveTextContent("15000");
      fireEvent.blur(input);
      expect(input).toHaveValue("15,000.00");
    },
  );

  it.each([
    [1, 3, "5", "1500", 1500],
    [2, 5, "234,56", "1,234,56", 1234.56],
    [0, 1, "12,345", "12,345,000", 12345000],
  ])("pega sobre una selección parcial %s..%s preservando el resto del importe", (inicio, final, pegado, raw, esperado) => {
    render(<Harness inicial={1000} />);
    const input = screen.getByLabelText("Importe") as HTMLInputElement;
    input.setSelectionRange(inicio, final);
    fireEvent.paste(input, { clipboardData: { getData: () => pegado } });
    fireEvent.input(input, { target: { value: raw }, inputType: "insertFromPaste" });
    expect(screen.getByLabelText("Monto capturado")).toHaveTextContent(String(esperado));
  });

  it.each(["insertFromPaste", "insertFromDrop", "insertReplacementText"])(
    "usa la selección previa para %s aunque no llegue clipboardData",
    (inputType) => {
      render(<Harness inicial={1000} />);
      const input = screen.getByLabelText("Importe") as HTMLInputElement;
      input.focus();
      input.setSelectionRange(2, 2);
      fireEvent.select(input);
      fireEvent.input(input, { target: { value: "1,5000" }, inputType });
      expect(input).toHaveValue("15,000");
      expect(screen.getByLabelText("Monto capturado")).toHaveTextContent("15000");
    },
  );

  it("conserva el signo y la parte decimal al pegar dentro de un importe negativo", () => {
    render(<Harness inicial={-1000.25} allowNegative />);
    const input = screen.getByLabelText("Importe") as HTMLInputElement;
    input.setSelectionRange(3, 3);
    fireEvent.paste(input, { clipboardData: { getData: () => "5" } });
    fireEvent.input(input, { target: { value: "-1,5000.25" }, inputType: "insertFromPaste" });
    expect(input).toHaveValue("-15,000.25");
    expect(screen.getByLabelText("Monto capturado")).toHaveTextContent("-15000.25");
  });

  it.each(["1234.567", "1234,56", "1,234,567"])(
    "interpreta %s como importe nuevo al reemplazar toda la selección",
    (pegado) => {
      render(<Harness inicial={1000} />);
      const input = screen.getByLabelText("Importe") as HTMLInputElement;
      input.setSelectionRange(0, input.value.length);
      fireEvent.paste(input, { clipboardData: { getData: () => pegado } });
      fireEvent.input(input, { target: { value: pegado }, inputType: "insertText" });
      expect(screen.getByLabelText("Monto capturado")).toHaveTextContent(
        pegado === "1,234,567" ? "1234567" : "1234.56",
      );
    },
  );

  it.each([
    ["12345", "12,345.00"],
    ["123456", "123,456.00"],
    ["1234567", "1,234,567.00"],
  ])("conserva %s tecleado dígito a dígito sin inputType", (digitos, esperado) => {
    render(<Harness />);
    const input = screen.getByLabelText("Importe") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "" } });
    for (const digito of digitos) {
      fireEvent.change(input, { target: { value: input.value + digito } });
    }
    expect(screen.getByLabelText("Monto capturado")).toHaveTextContent(digitos);
    fireEvent.blur(input);
    expect(input).toHaveValue(esperado);
  });

  it("conserva los miles al insertar dígitos con un InputEvent nativo", () => {
    render(<Harness inicial={1234} />);
    const input = screen.getByLabelText("Importe") as HTMLInputElement;
    for (const digito of "567") {
      fireEvent.input(input, {
        target: { value: input.value + digito }, data: digito, inputType: "insertText",
      });
    }
    expect(input).toHaveValue("1,234,567");
    expect(screen.getByLabelText("Monto capturado")).toHaveTextContent("1234567");
  });

  it("borra dígitos a través de las comas sin convertirlos a decimales", () => {
    render(<Harness inicial={12345} />);
    const input = screen.getByLabelText("Importe") as HTMLInputElement;
    for (const esperado of [1234, 123, 12, 1, 0]) {
      fireEvent.input(input, {
        target: { value: input.value.slice(0, -1) }, inputType: "deleteContentBackward",
      });
      expect(screen.getByLabelText("Monto capturado")).toHaveTextContent(String(esperado));
    }
    expect(input).toHaveValue("");
  });

  it.each([
    [12345, "12,9345", 129345, "insertText"],
    [12345, "1,345", 1345, "deleteContentBackward"],
    [1234567, "1,24,567", 124567, "deleteContentBackward"],
  ])("edita en medio de %s conservando el entero", (inicial, texto, esperado, inputType) => {
    render(<Harness inicial={inicial} />);
    fireEvent.input(screen.getByLabelText("Importe"), { target: { value: texto }, inputType });
    expect(screen.getByLabelText("Monto capturado")).toHaveTextContent(String(esperado));
  });

  it("acepta una coma decimal nueva después de los miles autoformateados", () => {
    render(<Harness inicial={1234} />);
    const input = screen.getByLabelText("Importe");
    fireEvent.input(input, { target: { value: "1,234," }, data: ",", inputType: "insertText" });
    fireEvent.input(input, { target: { value: "1,234.5" }, data: "5", inputType: "insertText" });
    expect(screen.getByLabelText("Monto capturado")).toHaveTextContent("1234.5");
  });

  it.each([
    ["1234,567", 1234.56],
    ["1,2345", 1.23],
    ["12345.678", 12345.67],
  ])("interpreta %s pegado como captura nueva aun si coincide con el texto anterior", (texto, esperado) => {
    render(<Harness inicial={1234} />);
    const input = screen.getByLabelText("Importe") as HTMLInputElement;
    input.setSelectionRange(0, input.value.length);
    fireEvent.paste(input, { clipboardData: { getData: () => texto } });
    // Safari y algunos eventos sintéticos omiten inputType: el evento paste
    // conserva la procedencia del valor sin depender de esa propiedad.
    fireEvent.change(input, { target: { value: texto } });
    expect(screen.getByLabelText("Monto capturado")).toHaveTextContent(String(esperado));
    fireEvent.blur(input);
    expect(screen.getByLabelText("Monto capturado")).toHaveTextContent(String(esperado));
  });

  it("respeta insertFromPaste aunque no llegue el evento paste", () => {
    render(<Harness inicial={1234} />);
    fireEvent.input(screen.getByLabelText("Importe"), {
      target: { value: "1,2345" }, inputType: "insertFromPaste",
    });
    expect(screen.getByLabelText("Monto capturado")).toHaveTextContent("1.23");
  });
});
