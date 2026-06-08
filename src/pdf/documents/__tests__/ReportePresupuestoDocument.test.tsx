import { describe, it, expect } from "vitest";
import { ReportePresupuestoDocument } from "../ReportePresupuestoDocument";
import { render } from "@testing-library/react";

const mockResumen = {
  periodo: "2023-01",
  total_presupuesto_mxn: 1000,
  total_real_mxn: 900,
  variacion_neta_mxn: 100,
  filas: [],
} as any;

describe("ReportePresupuestoDocument", () => {
  it("muestra título, período y aviso de sin categorías", () => {
    const { container } = render(<ReportePresupuestoDocument resumen={mockResumen} />);
    const text = container.textContent ?? "";
    expect(text).toContain("Presupuesto vs Real");
    expect(text).toContain("2023-01");
    expect(text).toContain("Sin categorías configuradas");
    expect(text).toContain("Detalle por categoría");
  });

  it("renderiza categorías cuando hay filas", () => {
    const resumen = {
      ...mockResumen,
      filas: [{
        categoria_nombre: "Fletes Marítimos",
        presupuesto_mxn: 100, real_mxn: 90,
        variacion_mxn: 10, cumplimiento_pct: 90,
      }],
    };
    const { container } = render(<ReportePresupuestoDocument resumen={resumen} />);
    const text = container.textContent ?? "";
    expect(text).toContain("Fletes Marítimos");
    expect(text).not.toContain("Sin categorías configuradas");
  });
});
