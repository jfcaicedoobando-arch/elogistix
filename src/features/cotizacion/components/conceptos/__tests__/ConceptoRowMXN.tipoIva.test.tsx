/**
 * IVA "No objeto de impuesto" (SAT 01) — renglón MXN de cotización.
 *
 * El renglón MXN comparte `ConceptoDescripcionSelector` con el de USD, así que
 * al elegir un producto del catálogo debe copiar el tratamiento fiscal
 * explícito (`tipo_iva`) sin inferirlo de la tasa 0.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ConceptoRowMXN } from "@/features/cotizacion/components/conceptos/ConceptoRowMXN";
import { ConceptoRowUSD } from "@/features/cotizacion/components/conceptos/ConceptoRowUSD";
import type { ConceptoVentaCotizacion } from "@/features/cotizacion/hooks";

const productoNoObjeto = {
  id: "sat-01",
  nombre: "Servicio no objeto",
  clave_unidad_sat: "E48",
  tipo_iva: "no_objeto",
};

vi.mock("@/features/cotizacion/components/conceptos/ProductoServicioSelect", () => ({
  ProductoServicioSelect: ({ onSelect }: { onSelect: (p: typeof productoNoObjeto) => void }) => (
    <button type="button" data-testid="mock-sat-select" onClick={() => onSelect(productoNoObjeto)}>
      pick
    </button>
  ),
}));

vi.mock("@/features/configuracion", () => ({
  useIvaFronteraHabilitada: () => false,
}));

vi.mock("@/features/cotizacion/components/conceptos/UnidadMedidaSelect", () => ({
  UnidadMedidaSelect: () => <div data-testid="unidad" />,
}));

const concepto: ConceptoVentaCotizacion = {
  descripcion: "",
  cantidad: 1,
  precio_unitario: 100,
  unidad_medida: "E48",
  aplica_iva: true,
  total: 116,
} as ConceptoVentaCotizacion;

describe("ConceptoRowMXN — tratamiento fiscal del catálogo", () => {
  it("copia tipo_iva no_objeto y no lo convierte en exento", () => {
    const actualizar = vi.fn();
    render(
      <ConceptoRowMXN
        concepto={concepto}
        index={0}
        total={1}
        actualizar={actualizar}
        eliminar={vi.fn()}
        tasaIva={0.16}
      />,
    );
    fireEvent.click(screen.getByTestId("mock-sat-select"));

    expect(actualizar).toHaveBeenCalledWith(0, "tipo_iva", "no_objeto");
    expect(actualizar).toHaveBeenCalledWith(0, "aplica_iva", false);
    expect(actualizar).toHaveBeenCalledWith(0, "tasa_iva_aplicada", 0);
    // Nunca se marca como exento: son tratamientos fiscales distintos.
    expect(actualizar).not.toHaveBeenCalledWith(0, "tipo_iva", "exento");
  });

  it.each([
    ["no_objeto", "No objeto · SAT 01"],
    ["exento", "Exento"],
  ])("muestra %s sin selector ni intento de cambiar la tasa", (tipoIva, etiqueta) => {
    const actualizar = vi.fn();
    render(
      <ConceptoRowMXN
        concepto={{ ...concepto, descripcion: "Servicio fiscal", tipo_iva: tipoIva, aplica_iva: false, tasa_iva_aplicada: 0, total: 100 }}
        index={0}
        total={1}
        actualizar={actualizar}
        eliminar={vi.fn()}
        tasaIva={0.16}
      />,
    );

    expect(screen.getByLabelText("Tratamiento de IVA")).toHaveValue(etiqueta);
    expect(screen.queryByLabelText("Tasa de IVA")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Tratamiento de IVA"));
    expect(actualizar).not.toHaveBeenCalled();
  });
});

describe("ConceptoRowUSD — tratamiento fiscal bloqueado", () => {
  it.each([
    ["no_objeto", "No objeto · SAT 01"],
    ["exento", "Exento"],
  ])("muestra %s sin selector ni intento de cambiar la tasa", (tipoIva, etiqueta) => {
    const actualizar = vi.fn();
    render(
      <ConceptoRowUSD
        concepto={{ ...concepto, descripcion: "Servicio fiscal", moneda: "USD", tipo_iva: tipoIva, aplica_iva: false, tasa_iva_aplicada: 0, total: 100 }}
        index={0}
        total={1}
        actualizar={actualizar}
        eliminar={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Tratamiento de IVA")).toHaveValue(etiqueta);
    expect(screen.queryByLabelText("Tasa de IVA")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Tratamiento de IVA"));
    expect(actualizar).not.toHaveBeenCalled();
  });
});
