/**
 * Regresión VIS-CE-251-07: capturar "1.5" en Cantidad ya no se convierte en
 * 15 (el parseInt anterior eliminaba el punto). El valor se confirma al blur.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConceptoRowMXN } from "@/features/cotizacion/components/conceptos/ConceptoRowMXN";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/hooks";

vi.mock("@/features/cotizacion/components/conceptos/ProductoServicioSelect", () => ({
  ProductoServicioSelect: () => <div data-testid="producto-select" />,
}));
vi.mock("@/features/cotizacion/components/conceptos/UnidadMedidaSelect", () => ({
  UnidadMedidaSelect: () => <div data-testid="unidad-select" />,
}));

const base: ConceptoVentaCotizacion = {
  descripcion: "Flete", concepto: "Flete", unidad_medida: "", cantidad: 1,
  precio_unitario: 6000, moneda: "MXN", total: 6960,
  aplica_iva: true, tasa_iva_aplicada: 0.16, notas: "",
} as unknown as ConceptoVentaCotizacion;

describe("ConceptoRowMXN — cantidad decimal (VIS-CE-251-07)", () => {
  it("captura 1.5 sin perder el punto y confirma 1.5 al salir del campo", () => {
    const actualizar = vi.fn();
    render(
      <ConceptoRowMXN
        concepto={base}
        index={0}
        total={2}
        actualizar={actualizar}
        eliminar={vi.fn()}
        tasaIva={0.16}
      />,
    );
    const input = screen.getByLabelText("Cantidad") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "1.5" } });
    // Durante la captura se conserva el texto crudo (el punto no se elimina).
    expect(input.value).toBe("1.5");
    fireEvent.blur(input);
    expect(actualizar).toHaveBeenCalledWith(0, "cantidad", 1.5);
  });
});
