import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { FacturaManualConceptosTable } from "../FacturaManualConceptosTable";
import { construirLineasManuales, type ConceptoManualInput } from "../../services/facturaManualLineas";

vi.mock("@/features/configuracion", () => ({ useIvaFronteraHabilitada: () => false }));

function Harness() {
  const [conceptos, setConceptos] = useState<ConceptoManualInput[]>([
    { descripcion: "Flete", cantidad: 1, precio_unitario: 100, clave_sat: "78101800", tipo_iva: "gravado_16" },
  ]);
  const concepto = conceptos[0];
  const linea = concepto.cantidad > 0 ? construirLineasManuales(conceptos, 0.16)[0] : null;
  return <>
    <FacturaManualConceptosTable conceptos={conceptos} moneda="MXN" onChange={setConceptos} />
    <output aria-label="Cantidad capturada">{concepto.cantidad}</output>
    <output aria-label="Subtotal fiscal">{linea?.totalLinea ?? "Cantidad inválida"}</output>
    <output aria-label="IVA fiscal">{linea?.ivaLinea ?? "Cantidad inválida"}</output>
  </>;
}

describe("FacturaManualConceptosTable — cantidad fiscal", () => {
  it("captura 2.5 por teclado y conserva subtotal e IVA de la línea fiscal", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Cantidad del concepto 1");
    for (const value of ["2", "2.", "2.5"]) {
      fireEvent.change(input, { target: { value } });
      expect(input).toHaveValue(value);
    }
    fireEvent.blur(input);
    expect(screen.getByLabelText("Cantidad capturada")).toHaveTextContent("2.5");
    expect(screen.getByLabelText("Subtotal fiscal")).toHaveTextContent("250");
    expect(screen.getByLabelText("IVA fiscal")).toHaveTextContent("40");
    expect(screen.getByText(/250\.00/)).toBeInTheDocument();
  });

  it.each(["0.5", "1.5", "0.000001"])("acepta %s insertado como cantidad fiscal", (value) => {
    render(<Harness />);
    const input = screen.getByLabelText("Cantidad del concepto 1");
    fireEvent.change(input, { target: { value } });
    fireEvent.blur(input);
    expect(input).toHaveValue(value);
    expect(screen.getByLabelText("Cantidad capturada")).toHaveTextContent(value);
    expect(screen.getByLabelText("Subtotal fiscal")).not.toHaveTextContent("Cantidad inválida");
  });

  it("permite vacío/punto y no sustituye una cantidad inválida por uno", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Cantidad del concepto 1");
    for (const value of ["", "."]) {
      fireEvent.change(input, { target: { value } });
      expect(input).toHaveValue(value);
      expect(screen.getByLabelText("Cantidad capturada")).toHaveTextContent("0");
      expect(screen.getByLabelText("Subtotal fiscal")).toHaveTextContent("Cantidad inválida");
    }
    fireEvent.change(input, { target: { value: ".5" } });
    fireEvent.blur(input);
    expect(input).toHaveValue("0.5");
    expect(screen.getByLabelText("Subtotal fiscal")).toHaveTextContent("50");
  });
});
