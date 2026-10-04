import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ConceptosTotalesResumen } from "../ConceptosTotalesResumen";
import { calcularResumenConceptos } from "../../utils/resumenConceptos";
import { formatCurrency } from "@/lib/formatters";

describe("ConceptosTotalesResumen — moneda junto a cada valor", () => {
  it.each(["MXN", "USD"])("conserva cifras y unidad %s sin repetirla en las etiquetas", (moneda) => {
    const resumen = calcularResumenConceptos([{ monto: 100, cantidad: 1, iva: 16, ieps: 2 }], { retenciones: 3 });
    render(<ConceptosTotalesResumen resumen={resumen} moneda={moneda} />);
    for (const label of ["Subtotal", "IVA", "IEPS", "Retenciones", "Total"]) {
      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.queryByText(`${label} ${moneda}`)).not.toBeInTheDocument();
    }
    expect(screen.getByText(formatCurrency(100, moneda))).toBeInTheDocument();
    expect(screen.getByText(formatCurrency(115, moneda))).toBeInTheDocument();
    expect(screen.getByText(`−${formatCurrency(3, moneda)}`)).toBeInTheDocument();
  });

  it.each(["MXN", "USD"])("un total cero sigue identificado en %s", (moneda) => {
    render(<ConceptosTotalesResumen resumen={calcularResumenConceptos([])} moneda={moneda} />);
    expect(screen.getAllByText(formatCurrency(0, moneda))).toHaveLength(3);
    expect(screen.getByText("Total")).toBeInTheDocument();
  });
});
