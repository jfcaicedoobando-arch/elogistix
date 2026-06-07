import { describe, it, expect, vi } from "vitest";
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
  it("ReportePresupuestoDocument renderiza con resumen mínimo", () => {
    const { getByTestId } = render(<ReportePresupuestoDocument resumen={mockResumen} />);
    expect(getByTestId("pdf-doc")).toBeDefined();
  });

  it("debe renderizar con filas de categorías", () => {
    const resumen = {
      ...mockResumen,
      filas: [{ categoria_nombre: "C1", presupuesto_mxn: 100, real_mxn: 90, variacion_mxn: 10, cumplimiento_pct: 90 }]
    };
    const { getByTestId } = render(<ReportePresupuestoDocument resumen={resumen} />);
    expect(getByTestId("pdf-doc")).toBeDefined();
  });
});
