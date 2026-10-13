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

  it("respeta Solo excepciones vacío, conserva KPIs globales y declara alcance", () => {
    const resumen = { ...mockResumen, filas: [{ categoria_nombre: "No exportar", presupuesto_mxn: 100, real_mxn: 90 }] };
    const { container } = render(<ReportePresupuestoDocument resumen={resumen} filas={[]} soloExcesos />);
    expect(container.textContent).toContain("Filtro: Solo excepciones");
    expect(container.textContent).toContain("periodo completo");
    expect(container.textContent).toContain("Sin categorías con más del 110%");
    expect(container.textContent).not.toContain("No exportar");
  });
  it("advierte NC excluida por base histórica ausente", () => {
    const { container } = render(<ReportePresupuestoDocument resumen={{ ...mockResumen, notas_proveedor_sin_base_count: 1 }} />);
    expect(container.textContent).toContain("Reporte provisional");
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

it("EX08: exporta excepción, importe y porcentaje no aplicable con captura cero o ausente", () => {
  const base = { categoria_id: "c", categoria_nombre: "Sin base", presupuesto_mxn: 0, real_mxn: 250, variacion_mxn: 250, cumplimiento_pct: 0 };
  const resumen = { ...mockResumen, filas: [{ ...base, presupuesto_capturado: true }, { ...base, categoria_id: "s", presupuesto_capturado: false }] };
  const { container } = render(<ReportePresupuestoDocument resumen={resumen} soloExcesos />);
  expect(container.textContent).toContain("Solo excepciones (más del 110% o gasto positivo sin presupuesto)");
  expect(container.textContent).toContain("Gasto con presupuesto cero");
  expect(container.textContent).toContain("Gasto sin captura de presupuesto");
  expect(container.textContent).toContain("250.00");
  expect(container.textContent).toContain("—");
  expect(container.textContent).not.toContain("0.0%");
});
