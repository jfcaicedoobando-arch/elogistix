/**
 * Estandarización del wizard (paso 2): la cuadrícula de costos tiene
 * encabezados de columna y el pie de totales cae en las mismas columnas que
 * los campos, con los mismos anchos compartidos.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import TablaCostosLocal from "../TablaCostosLocal";
import { COL_COSTO } from "../costosLocal/columnasCosto";
import type { FilaCostoLocal } from "@/features/cotizacion/types";

vi.mock("@/features/cotizacion/hooks/useProductosCatalogo", () => ({
  useProductosCatalogo: () => ({ productos: [], isLoading: false, porNombre: new Map() }),
  tasaDesdeTipoIva: () => 0.16,
}));
vi.mock("@/lib/contexts/AuthContext", () => ({ useAuth: () => ({ organizationId: "org-1" }) }));

const fila: FilaCostoLocal = {
  concepto: "Flete marítimo",
  moneda: "USD",
  proveedor: "Naviera",
  cantidad: 2,
  costo_unitario: 100,
  precio_venta: 150,
  unidad_medida: "E48",
  clave_sat: "78101800",
  concepto_libre: false,
};

function renderTabla(f: FilaCostoLocal = fila) {
  return render(
    <TablaCostosLocal
      filas={[f]}
      filasMoneda={[f]}
      moneda="USD"
      title="Costos en USD"
      icon={<span />}
      totales={{ totalCosto: 200, totalVenta: 300, profit: 100, porcentaje: 33 }}
      onUpdate={() => {}}
      onAdd={() => {}}
      onRemove={() => {}}
    />,
  );
}

describe("TablaCostosLocal · columnas alineadas", () => {
  it("muestra encabezados de columna cuando hay filas", () => {
    renderTabla();
    for (const label of ["Concepto", "Proveedor", "Unidad", "Cant.", "Costo unit.", "Venta unit.", "Costo total", "Venta total", "Margen"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    // v13.823.286: "Utilidad" aparece también en el resumen compacto del pie
    // que se muestra cuando las columnas calculadas están ocultas.
    expect(screen.getAllByText(/Utilidad/).length).toBeGreaterThan(0);
  });

  it("el total de la columna usa el mismo ancho que su encabezado", () => {
    renderTabla();
    const encabezado = screen.getByText("Costo total");
    const total = screen.getByText("Totales");
    expect(encabezado.className).toContain(COL_COSTO.costoTotal);
    expect(total.className).toContain(COL_COSTO.concepto);
  });

  it("no muestra encabezados cuando la tabla está vacía", () => {
    render(
      <TablaCostosLocal
        filas={[]}
        filasMoneda={[]}
        moneda="USD"
        title="Costos en USD"
        icon={<span />}
        totales={{ totalCosto: 0, totalVenta: 0, profit: 0, porcentaje: 0 }}
        onUpdate={() => {}}
        onAdd={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(screen.queryByText("Costo unit.")).not.toBeInTheDocument();
    expect(screen.getByText(/Sin costos/)).toBeInTheDocument();
  });

  // v13.823.286: las notas quedan cerradas aunque la fila ya traiga texto (el
  // icono es el indicador); así la tabla no crece de alto sola.
  it("las notas están cerradas hasta pedirlas, incluso si la fila ya trae notas", () => {
    const { unmount } = renderTabla();
    expect(screen.queryByLabelText("Notas del concepto")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Agregar notas"));
    expect(screen.getByLabelText("Notas del concepto")).toBeInTheDocument();
    unmount();

    renderTabla({ ...fila, notas: "Sujeto a revisión" });
    expect(screen.queryByLabelText("Notas del concepto")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Agregar notas"));
    expect(screen.getByLabelText("Notas del concepto")).toHaveValue("Sujeto a revisión");
  });
});
