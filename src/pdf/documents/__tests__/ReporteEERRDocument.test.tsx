import { describe, it, expect, vi } from "vitest";
import { ReporteEERRDocument } from "../ReporteEERRDocument";
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
