import { describe, it, expect } from "vitest";
import { ReporteEERRDocument } from "../ReporteEERRDocument";
import { render } from "@testing-library/react";

const mockData = {
  ingresos: [],
  costos: [],
  totalIngresos: { total: 100000, porModo: {} },
  totalCostos: { total: 70000, porModo: {} },
  utilidad: { total: 30000, porModo: {} },
  margen: { total: 30, porModo: {} },
} as any;

describe("ReporteEERRDocument", () => {
  it("muestra título, período y leyenda 'Operativa' para fuente=embarques", () => {
    const { container } = render(
      <ReporteEERRDocument periodo="2023-01" fuente="embarques" data={mockData} />,
    );
    const text = container.textContent ?? "";
    expect(text).toContain("Estado de Resultados");
    expect(text).toContain("2023-01");
    expect(text).toContain("Operativa");
    expect(text).toContain("Ingresos");
    expect(text).toContain("Costos");
    expect(text).toContain("30.0%");
  });

  it("muestra leyenda 'Devengada' para fuente=facturas", () => {
    const { container } = render(
      <ReporteEERRDocument periodo="2023-01" fuente="facturas" data={mockData} />,
    );
    expect(container.textContent ?? "").toContain("Devengada");
  });
});
