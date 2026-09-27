import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import TablaCostosDetalle from "../TablaCostosDetalle";
import { calcTotalsPL } from "../costosPLTypes";

describe("costos de cotización: unidad frente a total", () => {
  it.each([
    { cantidad: 2, costo_unitario: 3200, venta: 7200, total: "USD 6,400.00" },
    { cantidad: 960, costo_unitario: 2.6, venta: 2880, total: "USD 2,496.00" },
  ])("explica la cantidad $cantidad sin sumar tarifas unitarias en el pie", (datos) => {
    const fila = { concepto: "Flete internacional", proveedor: "Agente de origen", moneda: "USD" as const, ...datos };
    render(<TablaCostosDetalle filas={[fila]} filasMoneda={[fila]} moneda="USD" title="Costos en USD"
      icon={null} totales={calcTotalsPL([{ cantidad: fila.cantidad, costo: fila.costo_unitario, venta: fila.venta }])}
      canEdit={false} onUpdate={() => {}} />);
    const tabla = within(screen.getByRole("table", { name: "Costos de escritorio en USD" }));
    expect(tabla.getByRole("columnheader", { name: "Cantidad" })).toBeInTheDocument();
    expect(tabla.getByRole("columnheader", { name: "Costo total" })).toBeInTheDocument();
    expect(tabla.getByRole("columnheader", { name: "Venta total" })).toBeInTheDocument();
    const pie = tabla.getByText("Totales").closest("tr")!;
    expect(within(pie).getAllByRole("cell")[1]).toHaveTextContent(datos.total);
    expect(within(screen.getByRole("list", { name: "Costos móviles en USD" })).getByText(/^Cantidad:/)).toHaveTextContent(`Cantidad: ${datos.cantidad}`);
  });
});
