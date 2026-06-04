import { describe, it, expect, vi } from "vitest";
import { ReportePresupuestoDocument } from "../ReportePresupuestoDocument";
import { render } from "@testing-library/react";

vi.mock("@react-pdf/renderer", async () => {
  const actual = await vi.importActual("@react-pdf/renderer");
  return {
    ...actual as any,
    Document: ({ children }: any) => <div data-testid="pdf-doc">{children}</div>,
    Page: ({ children }: any) => <div data-testid="pdf-page">{children}</div>,
    View: ({ children }: any) => <div data-testid="pdf-view">{children}</div>,
    Text: ({ children }: any) => <div data-testid="pdf-text">{children}</div>,
  };
});

const mockResumen = {
  periodo: "2023-01",
  total_presupuesto_mxn: 1000,
  total_real_mxn: 900,
  variacion_neta_mxn: 100,
  filas: [],
} as any;

describe("ReportePresupuestoDocument", () => {
  it("debe renderizar sin errores con resumen mínimo", () => {
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
