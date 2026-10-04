import { describe, expect, it } from "vitest";
import { act, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { useState } from "react";
import { useTotalesConceptosCaptura } from "../useTotalesConceptosCaptura";
import { initialValues, calcularTotal } from "../useNuevaFacturaProveedorForm.helpers";
import { calcularCuadreConceptos } from "../../utils/cuadreConceptos";
import { TotalesDesdeConceptos } from "../../components/TotalesDesdeConceptos";
import type { CfdiConceptoParsed } from "@/features/cxp/services";

const conceptos: CfdiConceptoParsed[] = [{ descripcion: "Flete neto de descuento", cantidad: 1, importe: 100, iva: 16, ieps: 0 }];
function useHarness(args: { manual: boolean; guardando: boolean; conceptos: CfdiConceptoParsed[] }, retenciones = "") {
  const [values, setValues] = useState({ ...initialValues(), retenciones });
  const totales = useTotalesConceptosCaptura({ ...args, values, setValues });
  return { values, setValues, totales, total: calcularTotal(values) };
}

describe("useTotalesConceptosCaptura — adopción explícita", () => {
  it("no altera cabecera automáticamente; la acción adopta totales y conserva retenciones", () => {
    const { result } = renderHook(() => useHarness({ manual: true, guardando: false, conceptos }, "5"));
    expect(result.current.values.subtotal).toBe("");
    expect(result.current.totales.propuesta).toMatchObject({ subtotal: 100, iva: 16, retenciones: 5, total: 111 });
    act(() => result.current.totales.aplicar());
    expect(result.current.values).toMatchObject({ subtotal: "100.00", iva: "16.00", ieps: "0.00", retenciones: "5" });
    expect(result.current.total).toBe(111);
    expect(result.current.totales.difiere).toBe(false);
    expect(calcularCuadreConceptos(100, conceptos.map((c) => ({ monto: c.importe, cantidad: c.cantidad }))).puedeAprobar).toBe(true);
  });
  it("conserva precisión de precios netos/cantidades y suma impuestos sin inventar tasas", () => {
    const lineas = [
      { descripcion: "Prorrateo neto", cantidad: 3, importe: 0.3333, iva: 0.16, ieps: 0.02 },
      { descripcion: "Exento neto", cantidad: 0.5, importe: 10, iva: 0, ieps: 0 },
    ];
    const { result } = renderHook(() => useHarness({ manual: true, guardando: false, conceptos: lineas }, "0.01"));
    act(() => result.current.totales.aplicar());
    expect(result.current.values).toMatchObject({ subtotal: "6.00", iva: "0.16", ieps: "0.02", retenciones: "0.01" });
    expect(result.current.total).toBe(6.17);
    expect(lineas[0].importe).toBe(0.3333);
    expect(calcularCuadreConceptos(6, lineas.map((c) => ({ monto: c.importe, cantidad: c.cantidad }))).puedeAprobar).toBe(true);
  });
  it("la edición posterior avisa sin sobrescribir los importes adoptados", () => {
    const initialProps = { manual: true, guardando: false, conceptos };
    const { result, rerender } = renderHook((props) => useHarness(props), { initialProps });
    act(() => result.current.totales.aplicar());
    rerender({ ...initialProps, conceptos: [{ ...conceptos[0], importe: 120, iva: 19.2 }] });
    expect(result.current.values.subtotal).toBe("100.00");
    expect(result.current.totales.difiere).toBe(true);
    act(() => result.current.totales.aplicar());
    expect(result.current.values.subtotal).toBe("120.00");
    expect(result.current.total).toBe(139.2);
  });
  it("los documentos importados conservan su cabecera aun invocando la acción", () => {
    const { result } = renderHook(() => useHarness({ manual: false, guardando: false, conceptos }));
    act(() => result.current.setValues((prev) => ({ ...prev, subtotal: "500", iva: "80", retenciones: "10" })));
    act(() => result.current.totales.aplicar());
    expect(result.current.totales.visible).toBe(false);
    expect(result.current.values).toMatchObject({ subtotal: "500", iva: "80", retenciones: "10" });
  });
  it("partidas inválidas o guardado en curso bloquean la adopción", () => {
    const initialProps = { manual: true, guardando: true, conceptos };
    const { result, rerender } = renderHook((props) => useHarness(props), { initialProps });
    act(() => result.current.totales.aplicar());
    expect(result.current.values.subtotal).toBe("");
    rerender({ ...initialProps, guardando: false, conceptos: [{ ...conceptos[0], cantidad: 0 }] });
    expect(result.current.totales.puedeAplicar).toBe(false);
    act(() => result.current.totales.aplicar());
    expect(result.current.values.subtotal).toBe("");
  });
  it("el botón muestra la propuesta y comunica divergencia después de editar", () => {
    function Harness() {
      const [lineas, setLineas] = useState(conceptos);
      const result = useHarness({ manual: true, guardando: false, conceptos: lineas });
      return <>
        <TotalesDesdeConceptos totales={result.totales} moneda="MXN" />
        <button onClick={() => setLineas([{ ...conceptos[0], importe: 150 }])}>Editar concepto</button>
        <output aria-label="Subtotal de factura">{result.values.subtotal}</output>
      </>;
    }
    render(<Harness />);
    expect(screen.getByText(/precios netos de descuentos/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Usar totales de conceptos" }));
    expect(screen.getByLabelText("Subtotal de factura")).toHaveTextContent("100.00");
    fireEvent.click(screen.getByRole("button", { name: "Editar concepto" }));
    expect(screen.getByText(/^Los conceptos no coinciden/)).toHaveAttribute("role", "status");
    expect(screen.getByLabelText("Subtotal de factura")).toHaveTextContent("100.00");
  });
});
