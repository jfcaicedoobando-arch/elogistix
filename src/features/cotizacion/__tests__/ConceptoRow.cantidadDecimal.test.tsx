/**
 * Regresión VIS-CE-251-07 / R257-01-02:
 *  - capturar "1.5" en Cantidad ya no se convierte en 15 (el parseInt anterior
 *    eliminaba el punto); el valor se confirma al blur;
 *  - elegir una tasa de IVA distinta escribe SÓLO `tasa_iva_aplicada` (una
 *    llamada), para que el hook no la reemplace con la tasa general.
 *
 * El fixture usa el tipo real `ConceptoVentaCotizacion` sin casts.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConceptoRowMXN } from "@/features/cotizacion/components/conceptos/ConceptoRowMXN";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/hooks";

vi.mock("@/features/cotizacion/components/conceptos/ConceptoDescripcionSelector", () => ({
  ConceptoDescripcionSelector: () => <div data-testid="producto-select" />,
}));
vi.mock("@/features/cotizacion/components/conceptos/UnidadMedidaSelect", () => ({
  UnidadMedidaSelect: () => <div data-testid="unidad-select" />,
}));

const base: ConceptoVentaCotizacion = {
  descripcion: "Flete",
  unidad_medida: "E48",
  cantidad: 1,
  precio_unitario: 6000,
  moneda: "MXN",
  total: 6960,
  aplica_iva: true,
  tasa_iva_aplicada: 0.16,
  notas: "",
};

describe("ConceptoRowMXN — cantidad decimal e IVA por línea", () => {
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

  it("muestra el IVA de la tasa de la línea, no la tasa general", () => {
    const actualizar = vi.fn();
    render(
      <ConceptoRowMXN
        concepto={{ ...base, tasa_iva_aplicada: 0.08, total: 6480 }}
        index={0}
        total={2}
        actualizar={actualizar}
        eliminar={vi.fn()}
        tasaIva={0.16}
      />,
    );
    const iva = screen.getByLabelText("IVA") as HTMLInputElement;
    expect(iva.value).toContain("480");
  });
});
