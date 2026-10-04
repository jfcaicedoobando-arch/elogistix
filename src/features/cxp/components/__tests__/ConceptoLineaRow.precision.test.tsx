import { TooltipProvider } from "@/components/ui/tooltip";
import { useEffect, useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ConceptoLineaRow } from "../ConceptoLineaRow";
import { useConceptosManuales } from "../../hooks/useConceptosManuales";
import { useTotalesConceptosCaptura } from "../../hooks/useTotalesConceptosCaptura";
import { initialValues } from "../../hooks/useNuevaFacturaProveedorForm.helpers";

function Harness() {
  const manuales = useConceptosManuales();
  const [values, setValues] = useState(initialValues);
  const { reemplazar } = manuales;
  useEffect(() => reemplazar([
    { descripcion: "Almacenaje por unidad", cantidad: 100, importe: 0, iva: 0, ieps: 0 },
  ]), [reemplazar]);
  const totales = useTotalesConceptosCaptura({
    manual: true, guardando: false, conceptos: manuales.conceptos, values, setValues,
  });
  return <>
    {manuales.conceptos.map((c) => <ConceptoLineaRow key={c.key} concepto={c} moneda="MXN"
      onActualizar={manuales.actualizar} onEliminar={manuales.eliminar} />)}
    <output aria-label="Modelo">{JSON.stringify(manuales.conceptos)}</output>
    <output aria-label="Propuesta">{totales.propuesta?.subtotal}</output>
    <output aria-label="Subtotal adoptado">{values.subtotal}</output>
    <button onClick={totales.aplicar}>Usar totales</button>
  </>;
}

const modelo = () => JSON.parse(screen.getByLabelText("Modelo").textContent ?? "[]")[0];

describe("ConceptoLineaRow · precisión persistible", () => {
  it("pegar 0.014 normaliza modelo y propuesta antes del blur; el blur confirma 0.01", () => {
    render(<TooltipProvider><Harness /></TooltipProvider>);
    const precio = screen.getByRole("textbox", { name: "Precio unitario" });
    fireEvent.paste(precio, { clipboardData: { getData: () => "0.014" } });
    // El navegador emite input/change después de insertar el texto del portapapeles.
    fireEvent.change(precio, { target: { value: "0.014" } });
    expect(modelo().importe).toBe(0.01);
    expect(screen.getByLabelText("Propuesta")).toHaveTextContent(/^1$/);
    fireEvent.blur(precio);
    expect(precio).toHaveValue("0.01");
    fireEvent.click(screen.getByRole("button", { name: "Usar totales" }));
    expect(screen.getByLabelText("Subtotal adoptado")).toHaveTextContent("1.00");
    expect(modelo().cantidad * modelo().importe).toBe(1);
  });

  it.each([0.125, 1.234567])("conserva cantidad fraccionaria %s al salir del campo", (cantidad) => {
    render(<TooltipProvider><Harness /></TooltipProvider>);
    const campo = screen.getByRole("textbox", { name: "Cantidad" });
    fireEvent.change(campo, { target: { value: String(cantidad) } });
    fireEvent.blur(campo);
    expect(campo).toHaveValue(String(cantidad));
    expect(modelo().cantidad).toBe(cantidad);
  });

  it("una cantidad menor al mínimo no se transforma en una unidad ni permite adoptar totales", () => {
    render(<TooltipProvider><Harness /></TooltipProvider>);
    const campo = screen.getByRole("textbox", { name: "Cantidad" });
    fireEvent.change(campo, { target: { value: "0.0000001" } });
    fireEvent.blur(campo);
    expect(campo).toHaveValue("0");
    expect(campo).toHaveAttribute("aria-invalid", "true");
    expect(modelo().cantidad).toBe(0);
    expect(screen.getByRole("alert")).toHaveTextContent("0.000001");
    fireEvent.click(screen.getByRole("button", { name: "Usar totales" }));
    expect(screen.getByLabelText("Subtotal adoptado")).toHaveTextContent("");
  });

  it.each(["IVA del concepto", "IEPS del concepto"])("normaliza %s con el mismo redondeo que el modelo", (nombre) => {
    render(<TooltipProvider><Harness /></TooltipProvider>);
    const campo = screen.getByRole("textbox", { name: nombre });
    fireEvent.change(campo, { target: { value: "2.505" } });
    fireEvent.blur(campo);
    expect(campo).toHaveValue("2.51");
    expect(modelo()[nombre.startsWith("IVA") ? "iva" : "ieps"]).toBe(2.51);
  });
});
