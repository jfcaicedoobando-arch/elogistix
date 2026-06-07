import { describe, it, expect, vi } from "vitest";
import { ReporteEERRDocument } from "../ReporteEERRDocument";
import { render } from "@testing-library/react";

const mockData = {
  ingresos: [],
  costos: [],
  totalIngresos: { total: 0, porModo: {} },
  totalCostos: { total: 0, porModo: {} },
  utilidad: { total: 0, porModo: {} },
  margen: { total: 0, porModo: {} },
} as any;

describe("ReporteEERRDocument", () => {
  it("debe renderizar sin errores con datos mínimos", () => {
    const { getByTestId } = render(
      <ReporteEERRDocument periodo="2023-01" fuente="embarques" data={mockData} />
    );
    expect(getByTestId("pdf-doc")).toBeDefined();
  });

  it("debe renderizar con fuente facturas", () => {
    const { getByTestId } = render(
      <ReporteEERRDocument periodo="2023-01" fuente="facturas" data={mockData} />
    );
    expect(getByTestId("pdf-doc")).toBeDefined();
  });
});
