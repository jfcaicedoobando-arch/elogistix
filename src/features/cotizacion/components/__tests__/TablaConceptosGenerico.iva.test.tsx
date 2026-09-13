/**
 * v13.823.341 — el encabezado y las columnas de IVA salen de la tasa real de
 * los renglones, no de la tasa global de la organización.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import TablaConceptosGenerico from "@/features/cotizacion/components/TablaConceptosGenerico";

vi.mock("@/features/catalogos/hooks", () => ({ useTasaIVA: () => 0.16 }));

type Concepto = Parameters<typeof TablaConceptosGenerico>[0]["conceptos"][number];

const concepto = (aplica: boolean, tasa: number | null): Concepto =>
  ({
    descripcion: "Flete marítimo",
    unidad_medida: "E48",
    cantidad: 1,
    precio_unitario: 1000,
    total: 1000,
    aplica_iva: aplica,
    tasa_iva_aplicada: tasa,
  }) as unknown as Concepto;

describe("<TablaConceptosGenerico /> etiqueta de IVA", () => {
  it("sin conceptos gravados no dice '+ IVA' ni muestra columna de IVA", () => {
    render(
      <TablaConceptosGenerico
        moneda="MXN"
        conceptos={[concepto(false, 0)]}
        subtotal={1000}
        iva={0}
        total={1000}
      />,
    );
    expect(screen.getByText("Conceptos en MXN")).toBeInTheDocument();
    expect(screen.queryByText(/IVA \(/)).not.toBeInTheDocument();
    expect(screen.getByText(/tasa 0% o exentos/i)).toBeInTheDocument();
  });

  it("con conceptos gravados usa la tasa real del renglón", () => {
    render(
      <TablaConceptosGenerico
        moneda="MXN"
        conceptos={[concepto(true, 0.08)]}
        subtotal={1000}
        iva={80}
        total={1080}
      />,
    );
    expect(screen.getByText("Conceptos en MXN + IVA")).toBeInTheDocument();
    expect(screen.getAllByText("IVA (8%)").length).toBeGreaterThan(0);
  });
});
